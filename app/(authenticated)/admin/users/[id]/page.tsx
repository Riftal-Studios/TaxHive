import { UserDetail } from "@/components/mui/admin/user-detail";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetail id={id} />;
}
