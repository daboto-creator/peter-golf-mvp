import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261026165356_final_bulk_import_platform_hardening.sql"), "utf8");
const service = readFileSync(join(process.cwd(), "src/lib/bulk-import/service.ts"), "utf8");
const firstParty = migration.slice(migration.indexOf("create or replace function public.execute_first_party_bulk_import"), migration.indexOf("create or replace function public.execute_partner_bulk_import"));
const partner = migration.slice(migration.indexOf("create or replace function public.execute_partner_bulk_import"));

describe("bulk executor SQL contracts", () => {
  it("preserves the restricted SECURITY DEFINER posture for both executors", () => {
    for (const sql of [firstParty, partner]) {
      expect(sql).toContain("security definer");
      expect(sql).toContain("set search_path = ''");
      expect(sql).toContain("public.can_manage_catalog()");
    }
    expect(migration).toContain("revoke all on function public.execute_first_party_bulk_import(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.execute_first_party_bulk_import(uuid) to authenticated");
    expect(migration).toContain("revoke all on function public.execute_partner_bulk_import(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.execute_partner_bulk_import(uuid) to authenticated");
  });

  it("retries only pending or failed rows and returns completed jobs without reprocessing", () => {
    for (const sql of [firstParty, partner]) {
      expect(sql).toContain("in ('PENDING_IMPORT','FAILED')");
      expect(sql).toContain("status='IMPORTED'");
      expect(sql).not.toMatch(/execution_status[^\n]+in \([^)]*IMPORTED/);
    }
  });

  it("uses the correct idempotency scope for each domain", () => {
    expect(firstParty).toContain("bel.source_scope_id=job.created_by and bel.external_id=btrim(row.external_id)");
    expect(partner).toContain("bel.partner_profile_id=v_job.partner_profile_id and bel.external_id=btrim(v_row.external_id)");
    expect(partner).toContain("values(requested_job_id,v_row.id,v_job.partner_profile_id");
  });

  it("keeps First Party financial rules out of Partner execution", () => {
    expect(firstParty).toContain("financialFloorOverrideApproved");
    expect(firstParty).toContain("public.can_override_pricing_floor()");
    expect(firstParty).toContain("category_pricing_profiles");
    expect(partner).not.toContain("financialPriceMinor");
    expect(partner).not.toContain("can_override_pricing_floor");
    expect(partner).not.toContain("calculate_product_pricing");
    expect(partner).not.toContain("acquisitionCostMinor");
  });

  it("validates and persists the exact reviewed Partner economics snapshot", () => {
    expect(partner).toContain("publicPriceMinor");
    expect(partner).toContain("estimatedPartnerNetMinor");
    expect(partner).toContain("partnerNetMinor");
    expect(partner).toContain("meetsMinimumMarketplaceRevenue");
    expect(partner).toContain("pricing_snapshot)");
    expect(partner).toContain("v_inventory_id,v_pricing)");
    expect(partner).toContain("marketplace_pricing_snapshot=v_pricing");
  });

  it("sets every required failure category before its risky stage", () => {
    for (const category of [
      "INVALID_EXTERNAL_ID", "PRICING_REVIEW_REQUIRED", "FINANCIAL_FLOOR_VIOLATION",
      "ACQUISITION_COST_REQUIRED", "INVALID_QUANTITY", "MANUAL_MODEL_APPROVAL_REQUIRED",
      "CATALOG_REFERENCE_UNAVAILABLE", "PRODUCT_CREATION_FAILED", "PRICING_APPLICATION_FAILED",
      "INVENTORY_INITIALIZATION_FAILED", "INVENTORY_ADJUSTMENT_FAILED", "EXECUTION_LINK_FAILED",
    ]) expect(firstParty).toContain(`'${category}'`);
    for (const category of [
      "INVALID_EXTERNAL_ID", "PRICING_REVIEW_REQUIRED", "MARKETPLACE_ECONOMICS_INVALID",
      "MANUAL_MODEL_APPROVAL_REQUIRED", "CATALOG_REFERENCE_UNAVAILABLE", "INVALID_QUANTITY",
      "LISTING_CREATION_FAILED", "INVENTORY_INITIALIZATION_FAILED", "EXECUTION_LINK_FAILED",
    ]) expect(partner).toContain(`'${category}'`);
  });

  it("excludes excluded rows from all authoritative aggregate counters", () => {
    const aggregate = migration.slice(0, migration.indexOf("create or replace function public.execute_first_party_bulk_import"));
    expect(aggregate.match(/not bir\.excluded and bir\.execution_status/g)).toHaveLength(6);
    expect(aggregate.match(/count\(\*\) filter \(where not bir\.excluded\)/g)).toHaveLength(2);
  });

  it("recomputes approval from current durable row state and current First Party configuration", () => {
    expect(service).toContain("manual_resolution,validation_result,execution_status");
    expect(service).toContain("reconcileCurrentRowState({ importType: jobResult.data.import_type");
    expect(service).toContain("isFirstPartyPricingConfigurationCurrent(row.pricing_result, currentConfiguration)");
  });

  it("retains server-side imported-row mutation protection for both domains", () => {
    expect(service).toContain("Esta fila ya fue importada. Edita el producto desde Catálogo.");
    expect(service).toContain("Esta fila ya fue importada. Edita la publicación desde Marketplace.");
  });
});
