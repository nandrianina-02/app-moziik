import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
