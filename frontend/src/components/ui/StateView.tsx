import type { ReactNode } from "react";
export function StateView({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="state-view"><div className="state-view__mark" aria-hidden="true"/><h2>{title}</h2><div>{children}</div>{action}</div>; }
