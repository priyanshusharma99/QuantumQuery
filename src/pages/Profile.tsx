import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, LogOut, Upload, FileText, TrendingUp, Target, Award, Calendar, 
  User, Github, Linkedin, CheckCircle2, X, Sparkles, Clock, Activity 
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    linkedin_url: "",
    github_url: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    totalInterviews: 0,
    completedSessions: 0,
    averageScore: 0,
    peerSessions: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [skillGaps, setSkillGaps] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
    loadProfile();
    loadStats();
    loadRecentActivity();
    loadSkillGaps();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFormData({
          full_name: profileData.full_name || "",
          linkedin_url: profileData.linkedin_url || "",
          github_url: profileData.github_url || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessions } = await supabase
        .from("interview_sessions")
        .select("*")
        .eq("user_id", user.id);

      const { data: videoSessions } = await supabase
        .from("video_interview_sessions")
        .select("overall_score")
        .eq("user_id", user.id)
        .not("overall_score", "is", null);

      const { data: peerSessions } = await supabase
        .from("peer_interview_sessions")
        .select("*")
        .or(`host_user_id.eq.${user.id},guest_user_id.eq.${user.id}`);

      const totalInterviews = (sessions?.length || 0) + (videoSessions?.length || 0);
      const completedSessions = sessions?.filter(s => s.status === "completed").length || 0;
      const avgScore = videoSessions?.length 
        ? videoSessions.reduce((acc, s) => acc + s.overall_score, 0) / videoSessions.length 
        : 0;

      setStats({
        totalInterviews,
        completedSessions,
        averageScore: Math.round(avgScore),
        peerSessions: peerSessions?.length || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessions } = await supabase
        .from("interview_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentActivity(sessions || []);
    } catch (error) {
      console.error("Error loading recent activity:", error);
    }
  };

  const loadSkillGaps = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: recommendations } = await supabase
        .from("user_career_recommendations")
        .select("skill_gaps")
        .eq("user_id", user.id)
        .single();

      if (recommendations?.skill_gaps) {
        setSkillGaps(recommendations.skill_gaps as any[] || []);
      }
    } catch (error) {
      console.error("Error loading skill gaps:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      loadProfile();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf" || file.type.includes("document")) {
        setResumeFile(file);
      } else {
        toast.error("Please upload a PDF or DOC file");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) {
      toast.error("Please select a file first");
      return;
    }

    setSaving(true);
    setUploadProgress(0);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = resumeFile.name.split(".").pop();
      const fileName = `${user.id}/resume.${fileExt}`;

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(fileName, resumeFile, { upsert: true });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("resumes")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ resume_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Resume uploaded successfully!");
      loadProfile();
      setResumeFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error("Error uploading resume:", error);
      toast.error("Failed to upload resume");
      setUploadProgress(0);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
          <p className="text-muted-foreground animate-pulse">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/dashboard")}>
            <img src="/voke-logo.png" alt="Voke" className="w-8 h-8" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
              Profile & Settings
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Target className="h-8 w-8 text-violet-500" />
                <Badge variant="secondary" className="bg-violet-500/10 text-violet-500 border-violet-500/20">
                  Total
                </Badge>
              </div>
              <p className="text-4xl font-bold text-foreground mb-1 group-hover:scale-110 transition-transform">{stats.totalInterviews}</p>
              <p className="text-sm text-muted-foreground">Interviews Completed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Award className="h-8 w-8 text-green-500" />
                <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                  Done
                </Badge>
              </div>
              <p className="text-4xl font-bold text-foreground mb-1 group-hover:scale-110 transition-transform">{stats.completedSessions}</p>
              <p className="text-sm text-muted-foreground">Sessions Finished</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="h-8 w-8 text-blue-500" />
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  Score
                </Badge>
              </div>
              <p className="text-4xl font-bold text-foreground mb-1 group-hover:scale-110 transition-transform">{stats.averageScore}%</p>
              <p className="text-sm text-muted-foreground">Average Performance</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-pink-500/10 border-orange-500/20 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="h-8 w-8 text-orange-500" />
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                  Peer
                </Badge>
              </div>
              <p className="text-4xl font-bold text-foreground mb-1 group-hover:scale-110 transition-transform">{stats.peerSessions}</p>
              <p className="text-sm text-muted-foreground">Peer Practice Sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Sidebar */}
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="bg-card/30 backdrop-blur-xl border-border/50 sticky top-24">
              <CardContent className="p-4">
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeTab === "profile"
                        ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="font-medium">Profile Info</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("resume")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeTab === "resume"
                        ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span className="font-medium">Resume</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("skills")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeTab === "skills"
                        ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">Skills Progress</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("activity")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                      activeTab === "activity"
                        ? "bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        : "hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                    <span className="font-medium">Recent Activity</span>
                  </button>
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {activeTab === "profile" && (
              <Card className="bg-card/30 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-violet-500" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-wider">Email Address</Label>
                    <Input
                      id="email"
                      value={profile?.email || ""}
                      disabled
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name" className="text-muted-foreground text-xs uppercase tracking-wider">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Enter your full name"
                      className="border-border/50 focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_url" className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                      <Linkedin className="w-4 h-4" />
                      LinkedIn URL
                    </Label>
                    <Input
                      id="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                      placeholder="https://linkedin.com/in/yourprofile"
                      className="border-border/50 focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="github_url" className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                      <Github className="w-4 h-4" />
                      GitHub URL
                    </Label>
                    <Input
                      id="github_url"
                      value={formData.github_url}
                      onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                      placeholder="https://github.com/yourusername"
                      className="border-border/50 focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-lg transition-all hover:scale-105">
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === "resume" && (
              <Card className="bg-card/30 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-500" />
                    Resume Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {profile?.resume_url && (
                    <div className="p-6 border border-green-500/20 rounded-xl bg-green-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-green-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground flex items-center gap-2">
                              Current Resume
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </p>
                            <p className="text-sm text-muted-foreground">Uploaded successfully</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(profile.resume_url, "_blank")}
                          className="border-green-500/20 hover:bg-green-500/10"
                        >
                          View Resume
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Drag and Drop Zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-border/50 hover:border-violet-500/50 hover:bg-muted/30"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold mb-1">
                          {resumeFile ? resumeFile.name : "Drop your resume here"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          or click to browse • PDF, DOC, DOCX (Max 5MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  {resumeFile && (
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => setResumeFile(null)}
                        variant="outline"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleResumeUpload}
                        disabled={saving}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {saving ? "Uploading..." : "Upload Resume"}
                      </Button>
                    </div>
                  )}

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Uploading...</span>
                        <span className="font-medium">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "skills" && (
              <Card className="bg-card/30 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-500" />
                    Skill Development
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {skillGaps.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-2">No skill gaps identified yet</p>
                      <p className="text-sm text-muted-foreground">
                        Complete a career guidance assessment to see your personalized skill development plan.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {skillGaps.map((gap: any, index: number) => (
                        <div key={index} className="p-4 border border-border/50 rounded-lg hover:border-violet-500/50 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-foreground">{gap.skill}</h4>
                            <Badge variant={gap.importance === 'High' ? 'destructive' : gap.importance === 'Medium' ? 'default' : 'secondary'}>
                              {gap.importance} Priority
                            </Badge>
                          </div>
                          {gap.learning_resource && (
                            <p className="text-sm text-muted-foreground mb-3">{gap.learning_resource}</p>
                          )}
                          <Progress value={Math.random() * 60 + 20} className="h-2" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "activity" && (
              <Card className="bg-card/30 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-violet-500" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivity.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-2">No recent activity</p>
                      <p className="text-sm text-muted-foreground">
                        Start your first interview to see your progress here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:border-violet-500/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                              <Brain className="w-5 h-5 text-violet-500" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground capitalize">{activity.interview_type} Interview</h4>
                              <p className="text-sm text-muted-foreground">
                                {new Date(activity.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={activity.status === 'completed' ? 'default' : 'secondary'}>
                            {activity.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
