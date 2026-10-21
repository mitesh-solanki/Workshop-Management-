import en from "../../../messages/en.json";

export default function AuthLoading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center px-4 py-8">
      <p className="text-base text-muted-foreground">{en.common.loading}</p>
    </div>
  );
}
