import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  LogOut, CheckCircle2, Circle, BookOpen, Settings, Trophy, 
  Star, Lock, Zap, Target, Award, Sparkles, ArrowRight 
} from "lucide-react";
import { toast } from "sonner";

const LearningPaths = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [jobProfiles, setJobProfiles] = useState<any[]>([]);
  const [learningPaths, setLearningPaths] = useState<any[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const loadData = async () => {
    try {
      const { data: profiles } = await supabase
        .from("job_profiles")
        .select("*")
        .order("category");

      setJobProfiles(profiles || []);
      if (profiles && profiles.length > 0) {
        setSelectedProfile(profiles[0].id);
      }

      const { data: paths } = await supabase
        .from("learning_paths")
        .select("*")
        .order("priority");

      setLearningPaths(paths || []);

      if (user) {
        const { data: progress } = await supabase
          .from("user_progress")
          .select("*")
          .eq("user_id", user.id);

        setUserProgress(progress || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load learning paths");
    } finally {
      setLoading(false);
    }
  };

  const toggleProgress = async (pathId: string) => {
    if (!user) {
      toast.error("Please sign in to track your progress");
      navigate("/auth");
      return;
    }

    const existing = userProgress.find(p => p.learning_path_id === pathId);

    if (existing) {
      await supabase
        .from("user_progress")
        .update({ completed: !existing.completed, completed_at: !existing.completed ? new Date().toISOString() : null })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("user_progress")
        .insert({ user_id: user.id, learning_path_id: pathId, completed: true, completed_at: new Date().toISOString() });
    }

    loadData();
    toast.success("Progress updated!");
  };

  const isCompleted = (pathId: string) => {
    const progress = userProgress.find(p => p.learning_path_id === pathId);
    return progress?.completed || false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getCompletionPercentage = (profileId: string) => {
    const pathsForProfile = learningPaths.filter(p => p.job_profile_id === profileId);
    const completedPaths = pathsForProfile.filter(p => isCompleted(p.id));
    return pathsForProfile.length > 0 ? Math.round((completedPaths.length / pathsForProfile.length) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
          <p className="text-muted-foreground animate-pulse">Loading your learning paths...</p>
        </div>
      </div>
    );
  }

  const selectedProfileData = jobProfiles.find(p => p.id === selectedProfile);
  const pathsForSelectedProfile = learningPaths.filter(p => p.job_profile_id === selectedProfile);
  const completionPercentage = selectedProfile ? getCompletionPercentage(selectedProfile) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => user ? navigate("/dashboard") : navigate("/")}>
            <img src="/voke-logo.png" alt="Voke" className="w-8 h-8" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
              Learning Paths
            </h1>
          </div>
          <nav className="flex items-center gap-2">
            {user && (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                  Dashboard
                </Button>
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
                  <Settings className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            )}
            {!user && (
              <>
                <ThemeToggle />
                <Button onClick={() => navigate("/auth")}>Sign In</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 border-b border-border/40">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]"></div>
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 bg-violet-500/10 text-violet-500 border-violet-500/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Interactive Learning Journey
            </Badge>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
              Your Path to Mastery
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Follow a structured roadmap designed for your dream role. Track your progress, unlock achievements, and level up your skills.
            </p>
            {user && selectedProfile && (
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-semibold">{completionPercentage}% Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-500" />
                  <span className="text-muted-foreground">{pathsForSelectedProfile.filter(p => isCompleted(p.id)).length} / {pathsForSelectedProfile.length} Milestones</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Career Path Selector */}
        {jobProfiles.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Award className="w-6 h-6 text-violet-500" />
              Choose Your Career Path
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {jobProfiles.map((profile) => {
                const percentage = getCompletionPercentage(profile.id);
                const isSelected = selectedProfile === profile.id;
                
                return (
                  <Card
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile.id)}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      isSelected
                        ? "border-violet-500 bg-gradient-to-br from-violet-500/10 to-purple-500/10"
                        : "border-border/50 hover:border-violet-500/50"
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-2xl shadow-lg">
                          {profile.icon || "💼"}
                        </div>
                        {user && percentage > 0 && (
                          <Badge variant="secondary" className="bg-violet-500/10 text-violet-500 border-violet-500/20">
                            {percentage}%
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-bold mb-2">{profile.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{profile.description}</p>
                      {user && (
                        <Progress value={percentage} className="h-1.5 mt-4" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Visual Roadmap */}
        {pathsForSelectedProfile.length > 0 && selectedProfileData && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-violet-500" />
                {selectedProfileData.title} Roadmap
              </h2>
              {user && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Overall Progress:</span>
                  <div className="w-32">
                    <Progress value={completionPercentage} className="h-2" />
                  </div>
                  <span className="text-sm font-semibold">{completionPercentage}%</span>
                </div>
              )}
            </div>

            {/* Milestone Path */}
            <div className="relative">
              {/* Connecting Line */}
              <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 via-purple-500 to-fuchsia-500 opacity-20 hidden md:block"></div>
              
              {/* Milestones */}
              <div className="space-y-8">
                {pathsForSelectedProfile.map((path, index) => {
                  const completed = isCompleted(path.id);
                  const isLast = index === pathsForSelectedProfile.length - 1;
                  
                  return (
                    <div key={path.id} className="relative">
                      {/* Milestone Node */}
                      <div className="flex items-start gap-6">
                        {/* Node Circle */}
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all cursor-pointer group ${
                              completed
                                ? "bg-gradient-to-br from-green-500 to-emerald-500 border-green-500/30 shadow-lg shadow-green-500/30"
                                : "bg-card border-violet-500/30 hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20"
                            }`}
                            onClick={() => toggleProgress(path.id)}
                          >
                            {completed ? (
                              <CheckCircle2 className="w-8 h-8 text-white" />
                            ) : (
                              <Circle className="w-8 h-8 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                            )}
                          </div>
                          {completed && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                              <Star className="w-4 h-4 text-white" fill="white" />
                            </div>
                          )}
                        </div>

                        {/* Milestone Card */}
                        <Card
                          className={`flex-1 cursor-pointer transition-all hover:shadow-lg group ${
                            completed
                              ? "border-green-500/30 bg-green-500/5"
                              : "border-border/50 hover:border-violet-500/50"
                          }`}
                          onClick={() => toggleProgress(path.id)}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="secondary" className="text-xs">
                                    Step {index + 1}
                                  </Badge>
                                  {completed && (
                                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                                      <CheckCircle2 className="w-3 h-3 mr-1" />
                                      Completed
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="text-xl font-bold mb-2 group-hover:text-violet-500 transition-colors">
                                  {path.title}
                                </h3>
                                {path.description && (
                                  <p className="text-muted-foreground leading-relaxed">
                                    {path.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {completed ? (
                                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-green-500" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-violet-500" />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                              <span className="text-sm text-muted-foreground">
                                Click to {completed ? "mark as incomplete" : "mark as complete"}
                              </span>
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Journey Complete */}
              {user && completionPercentage === 100 && (
                <Card className="mt-12 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                  <CardContent className="p-8 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                      <Trophy className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">🎉 Journey Complete!</h3>
                    <p className="text-muted-foreground mb-6">
                      Congratulations! You've completed the {selectedProfileData.title} learning path.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={() => navigate("/dashboard")} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                        Go to Dashboard
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedProfile(jobProfiles[0]?.id)}>
                        Explore More Paths
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {learningPaths.length === 0 && (
          <Card className="p-12 text-center bg-card/30 backdrop-blur-xl border-border/50">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No Learning Paths Yet</h3>
            <p className="text-muted-foreground mb-6">
              Learning paths are being curated for you! Check back soon.
            </p>
          </Card>
        )}

        {/* CTA for Non-Logged-In Users */}
        {!user && learningPaths.length > 0 && (
          <Card className="mt-12 bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-500/30">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Sign in to track your progress</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create an account to mark milestones as completed and monitor your learning journey
              </p>
              <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700" onClick={() => navigate("/auth")}>
                Get Started Free
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LearningPaths;
