import { redirect } from 'next/navigation';

export default async function AdminAppModulesPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/admin/apps/${id}/editor`);
}
