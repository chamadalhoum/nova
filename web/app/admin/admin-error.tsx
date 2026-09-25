import { ApiError } from "@/lib/api";

export function AdminError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "NOVA could not complete this admin request.";
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <div className="rounded-3xl bg-red-50 p-5 text-red-800">
      <p>{message}</p>
      {requestId && <p className="mt-2 text-xs text-red-700">Request ID: {requestId}</p>}
    </div>
  );
}
