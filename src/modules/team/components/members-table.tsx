"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { Users } from "lucide-react";
import { RoleBadge } from "@/components/shared/role-badge";
import { InitialsAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListFiltersResetButton } from "@/components/ui/list-filters-reset-button";
import { SearchInput } from "@/components/ui/search-input";
import { MemberRowActions } from "@/modules/team/components/member-row-actions";

export type TeamMemberRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: Date | string;
};

type MembersTableProps = {
  members: TeamMemberRow[];
  canManageMembers: boolean;
  currentUserId: string;
  joinedLabels: Record<string, string>;
};

export function MembersTable({
  members,
  canManageMembers,
  currentUserId,
  joinedLabels,
}: MembersTableProps) {
  const t = useTranslations("team");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => {
      const name = (member.name ?? "").toLowerCase();
      const email = member.email.toLowerCase();
      const roleKey = member.role.toLowerCase();
      const roleLabel = t(`roles.${member.role}`).toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        roleKey.includes(q) ||
        roleLabel.includes(q)
      );
    });
  }, [members, query, t]);

  const columns = useMemo<ColumnDef<TeamMemberRow>[]>(
    () => [
      {
        id: "person",
        accessorFn: (row) => row.name ?? row.email,
        header: t("columns.member"),
        cell: ({ row }) => {
          const member = row.original;
          const name = member.name ?? member.email;
          return (
            <div className="flex items-center gap-3">
              <InitialsAvatar name={name} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                <p className="truncate text-caption text-muted-foreground">
                  {member.email}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: t("role"),
        cell: ({ row }) => (
          <RoleBadge label={t(`roles.${row.original.role}`)} />
        ),
      },
      {
        id: "status",
        accessorFn: () => "active",
        header: t("columns.status"),
        cell: () => <Badge variant="success">{t("statusActive")}</Badge>,
      },
      {
        id: "joined",
        accessorFn: (row) => joinedLabels[row.id] ?? "",
        header: t("columns.joined"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {joinedLabels[row.original.id] ?? ""}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        meta: { className: "w-[1%] whitespace-nowrap" },
        cell: ({ row }) => {
          const member = row.original;
          return (
            <MemberRowActions
              memberId={member.id}
              memberName={member.name ?? member.email}
              memberRole={member.role}
              canManage={canManageMembers}
              isSelf={member.id === currentUserId}
            />
          );
        },
      },
    ],
    [t, canManageMembers, currentUserId, joinedLabels],
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      defaultPageSize={10}
      toolbar={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <SearchInput
            id="team-member-search"
            value={query}
            onValueChange={setQuery}
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="w-full min-w-0 flex-1 md:max-w-md"
          />
          <ListFiltersResetButton
            label={tc("resetFilters")}
            disabled={!query.trim()}
            onReset={() => setQuery("")}
          />
        </div>
      }
      empty={
        members.length === 0 ? (
          <EmptyState icon={Users} title={t("emptyMembers")} />
        ) : undefined
      }
      renderMobileCard={(row) => {
        const member = row.original;
        const name = member.name ?? member.email;
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <InitialsAvatar name={name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{name}</p>
                <p className="truncate text-caption text-muted-foreground">
                  {member.email}
                </p>
              </div>
              <Badge variant="success">{t("statusActive")}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <RoleBadge label={t(`roles.${member.role}`)} />
              <span aria-hidden>·</span>
              <span>{joinedLabels[member.id] ?? ""}</span>
            </div>
            <MemberRowActions
              memberId={member.id}
              memberName={name}
              memberRole={member.role}
              canManage={canManageMembers}
              isSelf={member.id === currentUserId}
            />
          </div>
        );
      }}
    />
  );
}
