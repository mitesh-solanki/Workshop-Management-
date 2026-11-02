"use client";

import { useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-select";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { ListSortMenu } from "@/components/ui/list-sort-menu";
import { MasonryGrid } from "@/components/ui/masonry-grid";
import { SearchInput } from "@/components/ui/search-input";
import {
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatus,
} from "@/lib/service-order-status";
import {
  JobSlipCard,
  type JobSlipCardData,
} from "@/modules/job-slips/components/job-slip-card";
import { formatTechniciansList } from "@/modules/service-orders/technicians";

const PAGE_SIZE = 8;

type SlipSort = "newest" | "oldest" | "reg_asc" | "reg_desc";
type StatusFilter = "" | ServiceOrderStatus;

type Props = {
  slips: JobSlipCardData[];
};

export function JobSlipsBoard({ slips }: Props) {
  const t = useTranslations("jobSlips");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SlipSort>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtersActive =
    Boolean(query.trim()) || sort !== "newest" || Boolean(statusFilter);

  const sortOptions = useMemo(
    () => [
      { value: "newest" as const, label: t("sort.newest") },
      { value: "oldest" as const, label: t("sort.oldest") },
      { value: "reg_asc" as const, label: t("sort.regAsc") },
      { value: "reg_desc" as const, label: t("sort.regDesc") },
    ],
    [t],
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "", label: t("filters.all") },
      ...SERVICE_ORDER_STATUSES.map((status) => ({
        value: status,
        label: t(`statuses.${status}`),
      })),
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = slips.filter((slip) => {
      if (statusFilter && slip.status !== statusFilter) {
        return false;
      }
      if (!q) return true;

      const registration = slip.vehicle.registrationNumber.toLowerCase();
      const customer = slip.customer.name.toLowerCase();
      const phone = slip.customer.phone.toLowerCase();
      const complaint = slip.complaint.toLowerCase();
      const makeModel =
        `${slip.vehicle.make} ${slip.vehicle.model}`.toLowerCase();
      const workStation = (slip.bay ?? "").toLowerCase();
      const tech = formatTechniciansList(slip, "").toLowerCase();
      const statusLabel = t(`statuses.${slip.status}`).toLowerCase();
      const lines = slip.lines
        .map((line) => line.description.toLowerCase())
        .join(" ");

      return (
        registration.includes(q) ||
        customer.includes(q) ||
        phone.includes(q) ||
        complaint.includes(q) ||
        makeModel.includes(q) ||
        workStation.includes(q) ||
        tech.includes(q) ||
        statusLabel.includes(q) ||
        lines.includes(q)
      );
    });

    matched.sort((a, b) => {
      if (sort === "reg_asc" || sort === "reg_desc") {
        const cmp = a.vehicle.registrationNumber.localeCompare(
          b.vehicle.registrationNumber,
        );
        return sort === "reg_asc" ? cmp : -cmp;
      }
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });

    return matched;
  }, [query, slips, sort, statusFilter, t]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visibleCount);
  const hasMore = remaining > 0;
  const hasQueryOrFilter = Boolean(query.trim()) || Boolean(statusFilter);

  function resetVisible() {
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div className="space-y-4">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <SearchInput
          id="job-slips-search"
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            resetVisible();
          }}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="w-full min-w-0 flex-1 md:max-w-md"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="min-w-0">
            <label htmlFor="job-slips-status-filter" className="sr-only">
              {t("filterStatusLabel")}
            </label>
            <FormSelect
              id="job-slips-status-filter"
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as StatusFilter);
                resetVisible();
              }}
              options={statusFilterOptions}
              className="w-auto min-w-42"
              triggerClassName="h-11 min-h-11 w-auto min-w-42 rounded-lg border-slate-200 bg-white px-3 text-[13px] font-semibold shadow-xs"
            />
          </div>
          <ListSortMenu
            value={sort}
            options={sortOptions}
            onChange={(value) => {
              setSort(value);
              resetVisible();
            }}
            ariaLabel={t("sortLabel")}
          />
          <ListFiltersResetButton
            label={tc("resetFilters")}
            disabled={!filtersActive}
            onReset={() => {
              setQuery("");
              setSort("newest");
              setStatusFilter("");
              resetVisible();
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={hasQueryOrFilter ? t("emptySearchTitle") : t("emptyTitle")}
          description={
            hasQueryOrFilter
              ? t("emptySearchDescription")
              : t("emptyDescription")
          }
        />
      ) : (
        <>
          <MasonryGrid>
            {visible.map((slip) => (
              <JobSlipCard key={slip.id} slip={slip} />
            ))}
          </MasonryGrid>

          {hasMore ? (
            <div className="sticky bottom-3 z-10 flex justify-center pt-2 sm:bottom-4">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="min-h-12 w-full max-w-sm px-8 text-base font-semibold shadow-lg shadow-blue-600/25 ring-2 ring-blue-600/20 sm:w-auto"
                onClick={() =>
                  setVisibleCount((count) => count + PAGE_SIZE)
                }
              >
                {t("loadMoreWithCount", { count: remaining })}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
