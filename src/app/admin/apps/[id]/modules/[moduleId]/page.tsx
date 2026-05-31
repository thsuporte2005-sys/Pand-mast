import { redirect } from 'next/navigation';

export default async function AdminAppModuleDetailPage(
  props: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { id } = await props.params;
  redirect(`/admin/apps/${id}/editor`);
}
