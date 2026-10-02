import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-3xl border border-carma-100 bg-white p-8">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-carma-600" />
          <span className="text-[10px] tracking-[0.28em] text-neutral-800">CARMA</span>
        </div>
        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-neutral-800">Carma Admin</h1>
        <p className="mt-2 text-sm text-slate-blue">
          Internal ops dashboard. Sign in with your admin account.
        </p>
        <div className="mt-5 flex h-1.5 gap-2">
          <span className="flex-1 bg-carma-600" />
          <span className="flex-1 bg-signal" />
          <span className="flex-1 bg-cta" />
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
