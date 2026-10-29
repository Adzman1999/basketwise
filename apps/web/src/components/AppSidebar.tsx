import { LayoutDashboard, ReceiptText, ShoppingBasket, Tags } from 'lucide-react';
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
  { href: '#grocery-spending', label: 'Grocery spending', icon: ReceiptText },
  { href: '#grocery-catalog', label: 'Items & prices', icon: Tags },
];

function Brand() {
  return (
    <a href="#overview" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:size-8">
        <ShoppingBasket aria-hidden="true" className="size-5 group-data-[collapsible=icon]:size-4" />
      </span>
      <span className="min-w-0 group-data-[collapsible=icon]:hidden">
        <span className="block text-base font-semibold tracking-tight text-sidebar-foreground">Basketwise</span>
        <span className="block truncate text-xs text-sidebar-foreground/70">Household food costs</span>
      </span>
    </a>
  );
}

export default function AppSidebar({ activeHref }: { activeHref: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-sidebar-border">
      <SidebarHeader className="px-4 py-5 group-data-[collapsible=icon]:px-2">
        <Brand />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const { label, icon: Icon } = item;
                const { href } = item;
                const isActive = activeHref === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
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
        <p className="text-xs font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">Your grocery notebook</p>
        <p className="mt-1 text-xs leading-5 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">Receipts, items, and prices in one place.</p>
      </SidebarFooter>
    </Sidebar>
  );
}
