import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  linkText: string;
  linkHref: string;
  iconBgClass: string;
  isLoading?: boolean;
}

export default function StatCard({
  title,
  value,
  icon,
  linkText,
  linkHref,
  iconBgClass,
  isLoading = false
}: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center mb-3">
          <div className={`${iconBgClass} p-2 rounded-full mr-3 text-neutral-700`}>
            {icon}
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        
        {isLoading ? (
          <Skeleton className="h-9 w-24 mb-3" />
        ) : (
          <p className="text-3xl font-bold mb-3">{value}</p>
        )}
        
        <Link href={linkHref} className="mt-auto">
          <span className="text-secondary text-sm hover:underline">{linkText}</span>
        </Link>
      </CardContent>
    </Card>
  );
}
