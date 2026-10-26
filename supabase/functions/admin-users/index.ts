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

  let body: { action?: string; email?: string; password?: string; fullName?: string; userId?: string; amount?: string; operation?: string; reason?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Request body must be valid JSON." }); }

  if (body.action === "list") {
    const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return reply(400, { error: error.message });
    const users = await Promise.all((data.users || []).map(async (u) => {
      const [{ data: roles, error: rolesError }, { data: profile, error: profileError }, { data: account, error: accountError }] = await Promise.all([
        adminClient.from("user_roles").select("role").eq("user_id", u.id),
        adminClient.from("profiles").select("full_name").eq("id", u.id).maybeSingle(),
        adminClient.from("accounts").select("id,account_number,currency").eq("owner_id", u.id).eq("is_demo", true).limit(1).maybeSingle(),
      ]);
      // A missing related record should not crash the entire user list.
      if (rolesError) console.error("admin-users: roles lookup failed", rolesError.message);
      if (profileError) console.error("admin-users: profile lookup failed", profileError.message);
      if (accountError) console.error("admin-users: account lookup failed", accountError.message);
      let balance_minor = 0;
      if (account?.id) {
        const { data: entries, error: entriesError } = await adminClient.from("ledger_entries")
          .select("amount_minor").eq("account_id", account.id);
        if (entriesError) console.error("admin-users: balance lookup failed", entriesError.message);
        else balance_minor = (entries || []).reduce((sum, entry) => sum + Number(entry.amount_minor), 0);
      }
      return {
        id: u.id, email: u.email || "", created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null, email_confirmed_at: u.email_confirmed_at || null,
        full_name: profile?.full_name || String(u.user_metadata?.full_name || ""),
        roles: (roles || []).map((r) => r.role),
        account_id: account?.id || null, account_number: account?.account_number || null,
        currency: account?.currency || "USD", balance_minor,
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

  if (body.action === "balance_adjust") {
    const userId = body.userId?.trim();
    const operation = body.operation?.trim();
    const reason = body.reason?.trim() || "";
    const amount = Number(body.amount);
    if (!userId) return reply(400, { error: "Select a customer." });
    if (!["add", "deduct"].includes(operation || "")) return reply(400, { error: "Choose add or deduct." });
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) return reply(400, { error: "Enter a valid amount greater than zero." });
    if (reason.length < 3 || reason.length > 240) return reply(400, { error: "Reason must be between 3 and 240 characters." });
    const { data: target, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !target.user) return reply(404, { error: "Customer not found." });
    const { data: account, error: accountError } = await adminClient.from("accounts")
      .select("id,account_number,currency").eq("owner_id", userId).eq("is_demo", true).eq("status", "active")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (accountError) return reply(400, { error: accountError.message });
    if (!account) return reply(404, { error: "Customer has no active account to adjust." });
    const amountMinor = Math.round(amount * 100);
    if (amountMinor <= 0) return reply(400, { error: "Amount must be at least $0.01." });
    const { data: transactionId, error: adjustError } = await adminClient.rpc("admin_adjust_account_balance", {
      p_actor_id: actor.id,
      p_account_id: account.id,
      p_amount_minor: amountMinor,
      p_operation: operation,
      p_reason: reason,
    });
    if (adjustError) return reply(400, { error: adjustError.message });
    return reply(200, { transaction_id: transactionId, account_id: account.id, account_number: account.account_number, currency: account.currency, message: "Account balance updated and ledger entry recorded." });
  }

  if (body.action === "loans_list") {
    const { data: applications, error: applicationsError } = await adminClient
      .from("loan_applications")
      .select("id,user_id,amount,term_months,annual_rate,purpose,employment_status,monthly_income,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (applicationsError) return reply(400, { error: applicationsError.message });

    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) return reply(400, { error: authError.message });
    const userMap = new Map((authData.users || []).map((u) => [u.id, {
      email: u.email || "",
      full_name: String(u.user_metadata?.full_name || ""),
    }]));
    const userIds = [...new Set((applications || []).map((app) => app.user_id as string))];
    const { data: profiles, error: profilesError } = userIds.length
      ? await adminClient.from("profiles").select("id,full_name").in("id", userIds)
      : { data: [], error: null };
    if (profilesError) console.error("admin-users: loan profile lookup failed", profilesError.message);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name || ""]));
    const loans = (applications || []).map((app) => ({
      ...app,
      customer_email: userMap.get(app.user_id)?.email || "Unknown customer",
      customer_name: profileMap.get(app.user_id) || userMap.get(app.user_id)?.full_name || "Customer",
    }));
    return reply(200, { loans, total: loans.length });
  }

  if (body.action === "loan_update") {
    const loanId = body.loanId?.trim();
    const status = body.status?.trim();
    const allowedStatuses = ["submitted", "under_review", "approved", "declined", "closed"];
    if (!loanId) return reply(400, { error: "Select a loan application." });
    if (!status || !allowedStatuses.includes(status)) return reply(400, { error: "Choose a valid loan status." });
    const { data: loan, error: loanError } = await adminClient
      .from("loan_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", loanId)
      .select("id,status")
      .maybeSingle();
    if (loanError) return reply(400, { error: loanError.message });
    if (!loan) return reply(404, { error: "Loan application not found." });
    return reply(200, { loan, message: "Loan application status updated." });
  }

  return reply(400, { error: "Unsupported action." });
});
