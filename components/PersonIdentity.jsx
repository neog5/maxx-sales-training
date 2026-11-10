import Link from "next/link";
import { displayName, initial } from "@/lib/people";
import { routes } from "@/lib/routes";

// Avatar, linked name and a detail line for a person in admin tables.
export default function PersonIdentity({ person, children }) {
  return (
    <div className="people-identity">
      <span className="people-avatar" aria-hidden="true">{initial(person.full_name)}</span>
      <span>
        <Link className="profile-link" href={routes.profile(person.id)}>{displayName(person)}</Link>
        {children && <small>{children}</small>}
      </span>
    </div>
  );
}
