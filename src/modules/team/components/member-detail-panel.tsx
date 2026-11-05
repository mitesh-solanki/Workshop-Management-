"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  HandCoins,
  History,
  IndianRupee,
  KeyRound,
  Mail,
  Pencil,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { usePageDetailLabel } from "@/components/page-chrome";
import {
  SectionDesktopNav,
  SectionMobileNavBar,
} from "@/components/shared/section-side-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import {
  sectionDomId,
  useSectionScrollSpy,
} from "@/hooks/use-section-scroll-spy";
import { formatRupees, type Paise } from "@/lib/money";
import { cn } from "@/lib/utils";
import { AdvanceRowActions } from "@/modules/payroll/components/advance-row-actions";
import { AddMemberPayrollModal } from "@/modules/payroll/components/add-member-payroll-modal";
import type { AddPayrollMember } from "@/modules/payroll/components/add-payroll-form";
import { MoneyEntryModal } from "@/modules/payroll/components/money-entry-modal";
import { PayrollLineActions } from "@/modules/payroll/components/payroll-line-editor";
import { formatPeriodMonthYear } from "@/modules/payroll/date";
import { EditMemberModal } from "@/modules/team/components/edit-member-modal";
import { MemberAccessPanel } from "@/modules/team/components/member-access-panel";
import {
  MEMBER_SECTION_ID_PREFIX,
  memberSectionsFor,
  type MemberSection,
} from "@/modules/team/member-sections";

type MemberRole = "OWNER" | "MANAGER" | "TECHNICIAN" | "ACCOUNTANT";

type Props = {
  member: {
    id: string;
    name: string | null;
    email: string;
    role: MemberRole;
    isActive: boolean;
    hasPassword: boolean;
  };
  showPay: boolean;
  canManageAccess: boolean;
  /** Owner viewing their own profile — password set/reset only. */
  canManageOwnPassword?: boolean;
  canEditRole: boolean;
  yearMonth: string;
  payrollMember: AddPayrollMember | null;
  onCurrentMonthPayroll: boolean;
  openAddPayroll?: boolean;
  openAdvancePaise: number;
  payrollLines: Array<{
    id: string;
    payrollRunId: string;
    basicPaise: number;
    bonusPaise: number;
    commissionPaise: number;
    advanceDeductedPaise: number;
    adjustmentPaise: number;
    adjustmentNote: string | null;
    netPaise: number;
    status: "DRAFT" | "PAID";
    paidAt: string | null;
    paidMethod: "CASH" | "UPI" | "CARD" | "MIXED" | null;
    periodStart: string;
    periodEnd: string;
  }>;
  advances: Array<{
    id: string;
    remainingPaise: number;
    amountPaise: number;
    givenOn: string;
    method: "CASH" | "UPI" | "CARD" | "MIXED";
    note: string | null;
  }>;
  locale: string;
};

function SectionBlock({
  id,
  title,
  subtitle,
  action,
  sectionRef,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  sectionRef: (node: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      ref={sectionRef}
      className="min-w-0 scroll-mt-4 gap-0 overflow-hidden py-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-section-title text-slate-900">{title}</h2>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  muted = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <dt className="text-caption font-medium text-slate-500">{label}</dt>
        <dd
          className={cn(
            "text-body text-slate-900",
            muted && "text-slate-500",
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function SectionEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center sm:px-6">
      <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-0.5">
        <p className="text-section-title text-slate-900">{title}</p>
        <p className="max-w-md text-body text-slate-600">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function MemberDetailPanel({
  member,
  showPay,
  canManageAccess,
  canManageOwnPassword = false,
  canEditRole,
  yearMonth,
  payrollMember,
  onCurrentMonthPayroll,
  openAddPayroll = false,
  openAdvancePaise,
  payrollLines,
  advances,
  locale,
}: Props) {
  const t = useTranslations("team");
  const tp = useTranslations("payroll");
  const displayName = member.name?.trim() || member.email;
  usePageDetailLabel(displayName);

  const showAccessNav =
    canManageAccess || canManageOwnPassword || member.role !== "OWNER";

  const sections = useMemo(
    () =>
      memberSectionsFor({
        showPay,
        showAccess: showAccessNav,
      }),
    [showPay, showAccessNav],
  );

  const initialSection = sections[0] ?? "details";
  const { activeSection, scrollToSection, setSectionRef } =
    useSectionScrollSpy({
      sections,
      idPrefix: MEMBER_SECTION_ID_PREFIX,
      initialSection,
    });

  const memberOption = [{ id: member.id, label: displayName }];

  const editAction = canEditRole ? (
    <EditMemberModal member={member} size="md" />
  ) : null;

  const mobileEdit = canEditRole ? (
    <EditMemberModal
      member={member}
      size="sm"
      trigger={
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-9"
          aria-label={t("edit")}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      }
    />
  ) : undefined;

  const navItems = (
    [
      {
        id: "details" as const,
        label: t("memberDetails"),
        icon: UserRound,
      },
      ...(showPay
        ? ([
            {
              id: "payroll" as const,
              label: tp("memberPayroll"),
              icon: IndianRupee,
            },
            {
              id: "openAdvances" as const,
              label: tp("openAdvances"),
              icon: HandCoins,
            },
          ] as const)
        : []),
      ...(showAccessNav
        ? ([
            {
              id: "access" as const,
              label: t("access"),
              icon: KeyRound,
            },
          ] as const)
        : []),
    ] satisfies Array<{
      id: MemberSection;
      label: string;
      icon: LucideIcon;
    }>
  );

  const navProps = {
    title: t("sectionsTitle"),
    items: navItems,
    active: activeSection,
    onChange: scrollToSection,
    backHref: "/team",
    backLabel: t("back"),
    heading: displayName,
    headingActions: mobileEdit,
  } as const;

  return (
    <div className="space-y-4">
      <Link
        href="/team"
        className="hidden h-5 max-h-5 items-center gap-0.5 px-0.5 text-[13px] leading-5 text-muted-foreground hover:text-teal-700 lg:inline-flex"
      >
        <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
        {t("back")}
      </Link>

      <header className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-[clamp(24px,3.5vw,30px)] leading-tight font-semibold tracking-[0.02em] text-[#152238]">
            {displayName}
          </h1>
        </div>
        {editAction}
      </header>

      <SectionMobileNavBar {...navProps} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] lg:gap-6">
        <SectionDesktopNav
          title={navProps.title}
          items={navProps.items}
          active={navProps.active}
          onChange={navProps.onChange}
          backHref={navProps.backHref}
          backLabel={navProps.backLabel}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <SectionBlock
            id={sectionDomId(MEMBER_SECTION_ID_PREFIX, "details")}
            title={t("memberDetails")}
            subtitle={t("memberDetailsDescription")}
            sectionRef={setSectionRef("details")}
          >
            <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:gap-x-8 sm:px-6">
              <Fact
                icon={Mail}
                label={t("email")}
                value={
                  <a
                    href={`mailto:${member.email}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {member.email}
                  </a>
                }
              />
              <Fact
                icon={UserRound}
                label={t("role")}
                value={t(`roles.${member.role}`)}
              />
              <Fact
                icon={KeyRound}
                label={t("columns.status")}
                value={
                  <Badge variant={member.isActive ? "success" : "danger"}>
                    {member.isActive
                      ? t("statusActive")
                      : t("statusDisabled")}
                  </Badge>
                }
              />
            </dl>
          </SectionBlock>

          {showPay ? (
            <>
              <SectionBlock
                id={sectionDomId(MEMBER_SECTION_ID_PREFIX, "payroll")}
                title={tp("memberPayroll")}
                subtitle={t("payoutHistoryDescription")}
                sectionRef={setSectionRef("payroll")}
                action={
                  <AddMemberPayrollModal
                    yearMonth={yearMonth}
                    payrollMember={payrollMember}
                    disabled={onCurrentMonthPayroll}
                    defaultOpen={openAddPayroll}
                  />
                }
              >
                {payrollLines.length === 0 ? (
                  <SectionEmpty
                    icon={History}
                    title={tp("noPayrollLines")}
                    body={t("payoutHistoryEmpty")}
                  />
                ) : (
                  <>
                    <ul className="space-y-3 p-3 md:hidden">
                      {payrollLines.map((line) => (
                        <li
                          key={line.id}
                          className="rounded-xl border border-border bg-card p-3.5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="font-semibold text-foreground">
                                {formatPeriodMonthYear(
                                  line.periodStart,
                                  locale,
                                )}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={
                                    line.status === "PAID"
                                      ? "success"
                                      : "warning"
                                  }
                                >
                                  {line.status === "PAID"
                                    ? tp("paid")
                                    : tp("unpaid")}
                                </Badge>
                                {line.status === "PAID" && line.paidAt ? (
                                  <span className="text-caption text-muted-foreground">
                                    {tp("paidOnDate", {
                                      date: new Intl.DateTimeFormat(locale, {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      }).format(new Date(line.paidAt)),
                                    })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <p className="shrink-0 font-semibold tabular-nums text-blue-700">
                              {formatRupees(line.netPaise as Paise, locale)}
                            </p>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 text-caption">
                            <div>
                              <dt className="text-muted-foreground">
                                {tp("columns.basic")}
                              </dt>
                              <dd className="font-medium tabular-nums">
                                {formatRupees(line.basicPaise as Paise, locale)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                {tp("columns.bonus")}
                              </dt>
                              <dd className="font-medium tabular-nums text-emerald-700">
                                {formatRupees(line.bonusPaise as Paise, locale)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                {tp("columns.advance")}
                              </dt>
                              <dd className="font-medium tabular-nums text-amber-700">
                                {formatRupees(
                                  line.advanceDeductedPaise as Paise,
                                  locale,
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">
                                {tp("columns.adjustment")}
                              </dt>
                              <dd className="font-medium tabular-nums">
                                {formatRupees(
                                  line.adjustmentPaise as Paise,
                                  locale,
                                )}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-3 flex justify-end border-t border-border pt-3">
                            <PayrollLineActions
                              lineId={line.id}
                              payrollRunId={line.payrollRunId}
                              memberName={displayName}
                              basicPaise={line.basicPaise}
                              bonusPaise={line.bonusPaise}
                              commissionPaise={line.commissionPaise}
                              advanceDeductedPaise={line.advanceDeductedPaise}
                              openAdvancePaise={openAdvancePaise}
                              adjustmentPaise={line.adjustmentPaise}
                              adjustmentNote={line.adjustmentNote}
                              netPaise={line.netPaise}
                              status={line.status}
                              locale={locale}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="hidden min-w-0 md:block">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-180 caption-bottom text-sm">
                          <thead className="border-b bg-slate-100">
                            <tr>
                              <th className="h-10 px-3 text-left font-medium text-slate-700">
                                {tp("columns.period")}
                              </th>
                              <th className="h-10 px-3 text-right font-medium text-slate-700">
                                {tp("columns.basic")}
                              </th>
                              <th className="h-10 px-3 text-right font-medium text-slate-700">
                                {tp("columns.bonus")}
                              </th>
                              <th className="h-10 px-3 text-right font-medium text-slate-700">
                                {tp("columns.advance")}
                              </th>
                              <th className="h-10 px-3 text-right font-medium text-slate-700">
                                {tp("columns.adjustment")}
                              </th>
                              <th className="h-10 px-3 text-right font-medium text-slate-700">
                                {tp("columns.netPay")}
                              </th>
                              <th className="h-10 px-3 text-left font-medium text-slate-700">
                                {tp("columns.status")}
                              </th>
                              <th className="h-10 px-3 text-left font-medium text-slate-700">
                                {tp("paidOn")}
                              </th>
                              <th className="h-10 w-[1%] whitespace-nowrap px-3 text-right font-medium text-slate-700">
                                {tp("columns.actions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {payrollLines.map((line) => (
                              <tr
                                key={line.id}
                                className="border-b border-border last:border-b-0"
                              >
                                <td className="px-3 py-2.5 font-medium">
                                  {formatPeriodMonthYear(
                                    line.periodStart,
                                    locale,
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">
                                  {formatRupees(
                                    line.basicPaise as Paise,
                                    locale,
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                                  {formatRupees(
                                    line.bonusPaise as Paise,
                                    locale,
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                                  {formatRupees(
                                    line.advanceDeductedPaise as Paise,
                                    locale,
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">
                                  {formatRupees(
                                    line.adjustmentPaise as Paise,
                                    locale,
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-blue-700">
                                  {formatRupees(line.netPaise as Paise, locale)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <Badge
                                    variant={
                                      line.status === "PAID"
                                        ? "success"
                                        : "warning"
                                    }
                                  >
                                    {line.status === "PAID"
                                      ? tp("paid")
                                      : tp("unpaid")}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">
                                  {line.status === "PAID" && line.paidAt
                                    ? new Intl.DateTimeFormat(locale, {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      }).format(new Date(line.paidAt))
                                    : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <PayrollLineActions
                                    lineId={line.id}
                                    payrollRunId={line.payrollRunId}
                                    memberName={displayName}
                                    basicPaise={line.basicPaise}
                                    bonusPaise={line.bonusPaise}
                                    commissionPaise={line.commissionPaise}
                                    advanceDeductedPaise={
                                      line.advanceDeductedPaise
                                    }
                                    openAdvancePaise={openAdvancePaise}
                                    adjustmentPaise={line.adjustmentPaise}
                                    adjustmentNote={line.adjustmentNote}
                                    netPaise={line.netPaise}
                                    status={line.status}
                                    locale={locale}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </SectionBlock>

              <SectionBlock
                id={sectionDomId(MEMBER_SECTION_ID_PREFIX, "openAdvances")}
                title={tp("openAdvances")}
                subtitle={t("openAdvancesDescription")}
                sectionRef={setSectionRef("openAdvances")}
                action={
                  <MoneyEntryModal
                    kind="advance"
                    members={memberOption}
                    defaultUserId={member.id}
                    size="md"
                  />
                }
              >
                {advances.length === 0 ? (
                  <SectionEmpty
                    icon={HandCoins}
                    title={tp("noOpenAdvances")}
                    body={t("openAdvancesEmpty")}
                  />
                ) : (
                  <div className="min-w-0 overflow-hidden">
                    <table className="w-full table-fixed caption-bottom text-sm">
                      <thead className="border-b bg-slate-100">
                        <tr>
                          <th className="h-10 w-[24%] px-5 text-left font-medium text-slate-700 sm:px-6">
                            {tp("remainingAmount")}
                          </th>
                          <th className="h-10 w-[24%] px-3 text-left font-medium text-slate-700">
                            {tp("amountShort")}
                          </th>
                          <th className="h-10 px-3 text-left font-medium text-slate-700">
                            {tp("paymentMethod")}
                          </th>
                          <th className="h-10 w-24 px-5 text-right font-medium text-slate-700 sm:px-6">
                            {tp("columns.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {advances.map((advance) => (
                          <tr
                            key={advance.id}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="px-5 py-2.5 font-medium tabular-nums sm:px-6">
                              {formatRupees(
                                advance.remainingPaise as Paise,
                                locale,
                              )}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">
                              {formatRupees(
                                advance.amountPaise as Paise,
                                locale,
                              )}
                            </td>
                            <td className="truncate px-3 py-2.5">
                              {tp(`methods.${advance.method}`)}
                            </td>
                            <td className="px-5 py-2.5 text-right sm:px-6">
                              <AdvanceRowActions advance={advance} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionBlock>
            </>
          ) : null}

          {showAccessNav ? (
            <SectionBlock
              id={sectionDomId(MEMBER_SECTION_ID_PREFIX, "access")}
              title={t("access")}
              subtitle={t("accessDescription")}
              sectionRef={setSectionRef("access")}
            >
              <MemberAccessPanel
                member={{
                  id: member.id,
                  name: member.name,
                  email: member.email,
                  isActive: member.isActive,
                  hasPassword: member.hasPassword,
                }}
                canManageAccess={canManageAccess}
                canManageOwnPassword={canManageOwnPassword}
              />
            </SectionBlock>
          ) : null}
        </div>
      </div>
    </div>
  );
}
