import type { ButtonHTMLAttributes } from "react"; import clsx from "clsx";
export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) { return <button className={clsx("button", `button--${variant}`, className)} {...props} />; }
