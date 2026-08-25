import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getPartnerScoreDashboard(partnerId: string) {
  const client = await createClient();
  const [summary, penalties, history, progress] = await Promise.all([
    client.rpc("get_own_partner_score_summary"),
    client
      .from("partner_penalties")
      .select(
        "id,event_code,severity,penalty_bps,status,reason,starts_at,expires_at,partner_visible",
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    client.rpc("get_own_partner_tier_history"),
    client.rpc("get_partner_tier_progress", {
      requested_partner_id: partnerId,
    }),
  ]);
  const first = summary.data?.[0];
  return {
    state: first
      ? {
          current_tier: first.current_tier,
          highest_eligible_tier: first.highest_eligible_tier,
          promotion_candidate_tier: first.promotion_candidate_tier,
          rolling_average_active_listings:
            first.rolling_average_active_listings,
          promotion_eligible_since: first.promotion_eligible_since,
          tier_at_risk_since: first.tier_at_risk_since,
        }
      : null,
    snapshot: first
      ? {
          score_status: first.score_status,
          completed_orders: first.completed_orders,
          final_score_bps: first.display_score_bps,
        }
      : null,
    components:
      summary.data?.map((entry) => ({
        component: entry.component,
        adjusted_score_bps: entry.component_display_score_bps,
      })) ?? [],
    penalties: penalties.data ?? [],
    history: history.data ?? [],
    progress: progress.data ?? [],
    error: summary.error ?? penalties.error ?? history.error ?? progress.error,
  };
}

export async function getPartnerScoreForOperations(partnerId: string) {
  const client = await createClient();
  const stateResult = await client
    .from("partner_score_tier_state")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();
  const state = stateResult.data;
  const [snapshot, components, penalties, history, progress] =
    await Promise.all([
      state?.latest_score_snapshot_id
        ? client
            .from("partner_score_snapshots")
            .select("*")
            .eq("id", state.latest_score_snapshot_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      state?.latest_score_snapshot_id
        ? client
            .from("partner_score_component_snapshots")
            .select("*")
            .eq("score_snapshot_id", state.latest_score_snapshot_id)
            .order("component")
        : Promise.resolve({ data: [], error: null }),
      client
        .from("partner_penalties")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false }),
      client
        .from("partner_tier_history")
        .select("*")
        .eq("partner_id", partnerId)
        .order("effective_at", { ascending: false })
        .limit(50),
      client.rpc("get_partner_tier_progress", {
        requested_partner_id: partnerId,
      }),
    ]);
  const [partner, events, overrides, risks, metrics, jobRuns] =
    await Promise.all([
      client
        .from("partner_profiles")
        .select(
          "id,status,legal_type,commercial_name,first_name,last_name,verified_at",
        )
        .eq("id", partnerId)
        .maybeSingle(),
      client
        .from("partner_score_events")
        .select(
          "id,component,outcome_code,score_bps,source,source_entity_type,occurred_at,created_at",
        )
        .eq("partner_id", partnerId)
        .order("occurred_at", { ascending: false })
        .limit(50),
      client
        .from("partner_score_tier_overrides")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false }),
      client
        .from("partner_risk_flags")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false }),
      client
        .from("partner_daily_listing_metrics")
        .select("metric_date,eligible,active_listing_count,calculated_at")
        .eq("partner_id", partnerId)
        .order("metric_date", { ascending: false })
        .limit(30),
      client
        .from("marketplace_score_job_runs")
        .select("id,job_key,status,as_of_date,processed_partners,completed_at")
        .or(`requested_partner_id.eq.${partnerId},requested_partner_id.is.null`)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
  return {
    state,
    snapshot: snapshot.data,
    components: components.data ?? [],
    penalties: penalties.data ?? [],
    history: history.data ?? [],
    progress: progress.data ?? [],
    partner: partner.data,
    events: events.data ?? [],
    overrides: overrides.data ?? [],
    risks: risks.data ?? [],
    metrics: metrics.data ?? [],
    jobRuns: jobRuns.data ?? [],
    error:
      stateResult.error ??
      snapshot.error ??
      components.error ??
      penalties.error ??
      history.error ??
      progress.error ??
      partner.error ??
      events.error ??
      overrides.error ??
      risks.error ??
      metrics.error ??
      jobRuns.error,
  };
}
