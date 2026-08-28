import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-neutral-50 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-neutral-900">Carma Admin</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Internal ops dashboard. Sign in with your admin account.
        </p>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
