import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "Server configuration is incomplete." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(401, { error: "Sign in is required." });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const actor = userData.user;
  if (userError || !actor) return reply(401, { error: "Your session is invalid or expired. Sign in again." });

  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: roleRows, error: roleError } = await adminClient.from("user_roles")
    .select("role").eq("user_id", actor.id).eq("role", "admin").limit(1);
  if (roleError) return reply(500, { error: "Unable to verify administrator permissions." });
  if (!roleRows?.length) return reply(403, { error: "Administrator access required. Assign the admin role to your account first." });

  let body: { action?: string; email?: string; password?: string; fullName?: string; userId?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Request body must be valid JSON." }); }

  if (body.action === "list") {
    const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return reply(400, { error: error.message });
    const users = await Promise.all((data.users || []).map(async (u) => {
      const [{ data: roles, error: rolesError }, { data: profile, error: profileError }, { data: account, error: accountError }] = await Promise.all([
        adminClient.from("user_roles").select("role").eq("user_id", u.id),
        adminClient.from("profiles").select("full_name").eq("id", u.id).maybeSingle(),
        adminClient.from("accounts").select("account_number").eq("owner_id", u.id).limit(1).maybeSingle(),
      ]);
      // A missing related record should not crash the entire user list.
      if (rolesError) console.error("admin-users: roles lookup failed", rolesError.message);
      if (profileError) console.error("admin-users: profile lookup failed", profileError.message);
      if (accountError) console.error("admin-users: account lookup failed", accountError.message);
      return {
        id: u.id, email: u.email || "", created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null, email_confirmed_at: u.email_confirmed_at || null,
        full_name: profile?.full_name || String(u.user_metadata?.full_name || ""),
        roles: (roles || []).map((r) => r.role), account_number: account?.account_number || null,
      };
    }));
    return reply(200, { users, total: data.total ?? users.length });
  }

  if (body.action === "create") {
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";
    const fullName = body.fullName?.trim() || "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Enter a valid email address." });
    if (password.length < 8) return reply(400, { error: "Password must contain at least 8 characters." });
    if (fullName.length < 2 || fullName.length > 100) return reply(400, { error: "Full name must be between 2 and 100 characters." });
    const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error) return reply(400, { error: error.message });
    return reply(200, { user: { id: data.user.id, email: data.user.email, full_name: fullName }, message: "User created." });
  }

  if (body.action === "delete") {
    const userId = body.userId?.trim();
    if (!userId) return reply(400, { error: "Select a user to delete." });
    if (userId === actor.id) return reply(400, { error: "You cannot delete your own signed-in administrator account." });
    const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !target.user) return reply(404, { error: "User not found." });

    const { data: accounts, error: accountError } = await adminClient.from("accounts").select("id").eq("owner_id", userId);
    if (accountError) return reply(400, { error: accountError.message });
    const accountIds = (accounts || []).map((a) => a.id as string);

    const transferQuery = adminClient.from("transfers").select("id")
      .or(accountIds.length
        ? `actor_id.eq.${userId},source_account_id.in.(${accountIds.join(",")}),destination_account_id.in.(${accountIds.join(",")})`
        : `actor_id.eq.${userId}`);
    const { data: transfers, error: transferReadError } = await transferQuery;
    if (transferReadError) return reply(400, { error: transferReadError.message });
    const transferIds = [...new Set((transfers || []).map((t) => t.id as string))];

    // Collect all related ledger transaction IDs before deleting any ledger entries.
    const ledgerIdSet = new Set<string>();
    if (accountIds.length) {
      const { data: entries, error } = await adminClient.from("ledger_entries")
        .select("ledger_transaction_id").in("account_id", accountIds);
      if (error) return reply(400, { error: error.message });
      for (const entry of entries || []) ledgerIdSet.add(entry.ledger_transaction_id as string);
    }
    if (transferIds.length) {
      const { data: ledgers, error } = await adminClient.from("ledger_transactions")
        .select("id").in("transfer_id", transferIds);
      if (error) return reply(400, { error: error.message });
      for (const ledger of ledgers || []) ledgerIdSet.add(ledger.id as string);
    }
    const ledgerIds = [...ledgerIdSet];

    // Delete in foreign-key order: entries -> ledger transactions -> transfers -> accounts.
    if (accountIds.length) {
      const { error } = await adminClient.from("ledger_entries").delete().in("account_id", accountIds);
      if (error) return reply(400, { error: error.message });
    }
    if (ledgerIds.length) {
      const { error } = await adminClient.from("ledger_entries").delete().in("ledger_transaction_id", ledgerIds);
      if (error) return reply(400, { error: error.message });
      const { error: ledgerDeleteError } = await adminClient.from("ledger_transactions").delete().in("id", ledgerIds);
      if (ledgerDeleteError) return reply(400, { error: ledgerDeleteError.message });
    }
    if (transferIds.length) {
      const { error } = await adminClient.from("transfers").delete().in("id", transferIds);
      if (error) return reply(400, { error: error.message });
    }
    if (accountIds.length) {
      const { error } = await adminClient.from("accounts").delete().in("id", accountIds);
      if (error) return reply(400, { error: error.message });
    }

    const { error: roleDeleteError } = await adminClient.from("user_roles").delete().eq("user_id", userId);
    if (roleDeleteError) return reply(400, { error: roleDeleteError.message });
    const { error: profileDeleteError } = await adminClient.from("profiles").delete().eq("id", userId);
    if (profileDeleteError) return reply(400, { error: profileDeleteError.message });
    const { error: auditUpdateError } = await adminClient.from("audit_logs").update({ actor_id: null }).eq("actor_id", userId);
    if (auditUpdateError) return reply(400, { error: auditUpdateError.message });
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) return reply(400, { error: deleteUserError.message });
    return reply(200, { message: "User and associated demo records deleted." });
  }
  return reply(400, { error: "Unsupported action." });
});
