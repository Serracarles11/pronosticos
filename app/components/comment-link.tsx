"use client";

import Link from "next/link";
import { MessageCircle } from "@/components/animate-ui/icons/message-circle";
import { CountUp } from "./count-up";

type Props = {
  href: string;
  count: number;
  label?: string;
  className?: string;
};

export function CommentLink({ href, count, label, className = "" }: Props) {
  return (
    <Link className={`comment-button ${className}`.trim()} href={href}>
      <MessageCircle animateOnHover className="comment-button__icon" size={18} />
      <CountUp className="count-up-text" duration={0.8} from={0} separator="." to={count} />
      {label ? <span>{label}</span> : null}
    </Link>
  );
}
