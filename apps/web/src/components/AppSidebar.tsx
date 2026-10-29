import { CirclePlus, LayoutDashboard, ReceiptText, Tags } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navigationItems = [
  { href: '#overview', label: 'Overview', icon: LayoutDashboard },
  { href: '#new-purchase', label: 'Add purchase', icon: CirclePlus },
  { href: '#purchase-history', label: 'Purchase history', icon: ReceiptText },
  { href: '#grocery-catalog', label: 'Items & prices', icon: Tags },
];

function Brand() {
  return (
    <a href="#overview" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sidebar-ring">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#dcebdc] sm:h-11 sm:w-11">
        <svg aria-hidden="true" viewBox="0 0 40 40" className="h-6 w-6 sm:h-7 sm:w-7" fill="none">
          <path d="M8 16h24l-2.2 15H10.2L8 16Z" stroke="#285E49" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="m14 16 4-8m8 8-4-8M9.2 22h21.6M15 22v7m5-7v7m5-7v7" stroke="#285E49" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold tracking-tight text-[#203b30] sm:text-lg">Basketwise</span>
        <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-[#6d7c70]">Household food costs</span>
      </span>
    </a>
  );
}

export default function AppSidebar({ activeHref }: { activeHref: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <Brand />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map(({ href, label, icon: Icon }) => {
                const isActive = activeHref === href;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                    >
                      <a
                        href={href}
                        aria-current={isActive ? 'location' : undefined}
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs font-medium text-[#607166] group-data-[collapsible=icon]:hidden">Your grocery notebook</p>
        <p className="mt-1 text-[11px] leading-5 text-[#8a978d] group-data-[collapsible=icon]:hidden">Receipts, items, and prices in one place.</p>
      </SidebarFooter>
    </Sidebar>
  );
}
