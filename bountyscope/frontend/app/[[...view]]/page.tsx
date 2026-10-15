import Workspace from "@/components/workspace";
import { Suspense } from "react";
export default function Page() { return <Suspense fallback={null}><Workspace /></Suspense>; }
