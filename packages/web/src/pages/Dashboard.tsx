import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ModuleInfo {
  number: number;
  title: string;
  description: string;
  status: "available" | "locked" | "completed";
  exerciseLink?: string;
  exerciseLabel?: string;
}

const MODULES: ModuleInfo[] = [
  {
    number: 1,
    title: "The New Landscape",
    description: "What changed, who builds software now, and why accountability matters.",
    status: "locked",
  },
  {
    number: 2,
    title: "The Machine Beneath",
    description: "Compilers, HTTP, databases, DevTools - the reality under the abstraction.",
    status: "available",
    exerciseLink: "/exercise/2/1",
    exerciseLabel: "Start: The Compiler Moment",
  },
  {
    number: 3,
    title: "The Probabilistic Machine",
    description: "Temperature, hallucination, cognitive surrender - why AI is confident and wrong.",
    status: "locked",
  },
  {
    number: 4,
    title: "Specification",
    description: "Writing specifications that constrain the machine's output.",
    status: "locked",
  },
  {
    number: 6,
    title: "Building with Agents",
    description: "Using AI agents to build from your specification.",
    status: "locked",
  },
  {
    number: 8,
    title: "Verification & Sustainable Practice",
    description: "Testing, acceptance, and maintaining human judgment over time.",
    status: "locked",
  },
];

export function Dashboard() {
  const { learner } = useAuth();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Software Pilotry</h1>
        {learner && (
          <span className="text-sm text-muted-foreground">
            {learner.display_name}
          </span>
        )}
      </header>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Curriculum Tracks</CardTitle>
          <CardDescription>
            Choose a learning track tailored to your experience level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/curriculum" className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80">
            Browse Tracks
          </Link>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-lg font-semibold">Modules</h2>

      <div className="flex flex-col gap-4">
        {MODULES.map((mod) => (
          <ModuleCard key={mod.number} {...mod} />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({ number, title, description, status, exerciseLink, exerciseLabel }: ModuleInfo) {
  const isLocked = status === "locked";

  return (
    <Card className={isLocked ? "opacity-50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">
            Module {number}: {title}
          </CardTitle>
          {status === "completed" && (
            <Badge variant="default" className="bg-success text-white">Completed</Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {exerciseLink && !isLocked && (
          <Link to={exerciseLink} className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80">
            {exerciseLabel || "Start Exercise"}
          </Link>
        )}
        {isLocked && (
          <p className="text-sm text-muted-foreground">
            Complete previous modules to unlock
          </p>
        )}
      </CardContent>
    </Card>
  );
}
