import Link from "next/link";

import { sidebarGroups } from "@/config/constants/sidebarNavs";
import { cn } from "@/lib/utils";
import { useRouter } from "next/router";

import dynamic from "next/dynamic";

const ProfileInfo = dynamic(() => import("./ProfileInfo"), { ssr: false });

export default function Sidebar() {
  const router = useRouter();
  const { pathname } = router;

  return (
    <div className="hidden border-r bg-muted/40 md:block max-h-screen min-h-screen">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-12 items-center justify-between border-b px-2 lg:px-2">
          <Link href="/" className="flex items-center gap-1 font-semibold">
            <img
              src="/favicon.png"
              width={26}
              height={26}
              alt="Immich Power Tools"
              className="w-6 h-6"
            />
            <span className="">Immich Power Tools</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="px-2 lg:px-4 space-y-4 py-2">
            {sidebarGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((nav) => (
                    <Link
                      key={nav.title}
                      href={nav.link}
                      className={cn(
                        "flex items-center gap-3 rounded-lg py-1.5 px-3 text-sm text-muted-foreground transition-all hover:text-primary",
                        {
                          "text-primary bg-primary/5 font-medium": pathname === nav.link,
                        }
                      )}
                    >
                      {nav.icon}
                      {nav.title}
                      {nav.badge && (
                        <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 leading-none">
                          {nav.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
        <div>
          <ProfileInfo />
        </div>
      </div>
    </div>
  );
}
