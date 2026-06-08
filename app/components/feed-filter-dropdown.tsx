"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  FiChevronDown,
  FiEdit,
  FiPlusSquare,
  FiShare,
  FiTrash,
} from "react-icons/fi";

export type FeedFilterOption = {
  href: string;
  label: string;
  active?: boolean;
  closeOnSelect?: boolean;
  icon?: "edit" | "plus" | "share" | "trash";
};

type FeedFilterDropdownProps = {
  activeCount: number;
  options: FeedFilterOption[];
};

const ICONS: Record<NonNullable<FeedFilterOption["icon"]>, IconType> = {
  edit: FiEdit,
  plus: FiPlusSquare,
  share: FiShare,
  trash: FiTrash,
};

const wrapperVariants = {
  open: {
    scaleY: 1,
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.045,
    },
  },
  closed: {
    scaleY: 0,
    opacity: 0,
    transition: {
      when: "afterChildren",
      staggerChildren: 0.025,
      staggerDirection: -1,
    },
  },
};

const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 },
};

const itemVariants = {
  open: {
    opacity: 1,
    y: 0,
    transition: {
      when: "beforeChildren",
    },
  },
  closed: {
    opacity: 0,
    y: -12,
    transition: {
      when: "afterChildren",
    },
  },
};

const actionIconVariants = {
  open: { scale: 1, y: 0 },
  closed: { scale: 0, y: -7 },
};

export function FeedFilterDropdown({ activeCount, options }: FeedFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 250 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function updateMenuPosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportPadding = 16;
    const width = Math.min(280, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - width - viewportPadding
    );

    setMenuPosition({
      left,
      top: rect.bottom + 8,
      width,
    });
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <motion.div
      animate={open ? "open" : "closed"}
      className="feed-filter-dropdown"
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        className="feed-filter-dropdown__button"
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
        }}
        ref={buttonRef}
        type="button"
      >
        <span>Filtros</span>
        {activeCount > 0 && <strong>{activeCount}</strong>}
        <motion.span className="feed-filter-dropdown__chevron" variants={iconVariants}>
          <FiChevronDown />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            animate="open"
            className="feed-filter-dropdown__menu"
            exit="closed"
            initial="closed"
            style={{
              left: menuPosition.left,
              originY: "top",
              top: menuPosition.top,
              width: menuPosition.width,
            }}
            variants={wrapperVariants}
          >
            {options.map((option) => (
              <Option key={`${option.label}-${option.href}`} option={option} setOpen={setOpen} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Option({
  option,
  setOpen,
}: {
  option: FeedFilterOption;
  setOpen: (value: boolean) => void;
}) {
  const Icon = ICONS[option.icon ?? "plus"];

  return (
    <motion.li variants={itemVariants}>
      <Link
        className={`feed-filter-dropdown__option ${option.active ? "is-active" : ""}`}
        href={option.href}
        onClick={() => {
          if (option.closeOnSelect) setOpen(false);
        }}
      >
        <motion.span className="feed-filter-dropdown__option-icon" variants={actionIconVariants}>
          <Icon />
        </motion.span>
        <span>{option.label}</span>
      </Link>
    </motion.li>
  );
}
