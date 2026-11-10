import TopNav from "@/components/TopNav";
import AdminTabs from "./AdminTabs";

// The shell every admin page shares: the top bar and the admin tabs.
export default function AdminPage({ profile, children }) {
  return (
    <div>
      <TopNav profile={profile} />
      <div className="admin-nav tp-fade-in">
        <AdminTabs role={profile.role} />
      </div>
      {children}
    </div>
  );
}
