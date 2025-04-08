import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Types for indexing settings
interface GlobalIndexingSettings {
  max_file_size_mb: number;
  skip_directories: string[];
  ignore_patterns: string[];
  supported_languages: string[];
  max_repository_size_gb: number;
  max_files_per_repository: number;
}

interface RepositorySettings {
  max_file_size_mb?: number;
  include_dirs?: string[];
  exclude_dirs?: string[];
  ignore_patterns?: string[];
  supported_extensions?: string[];
}

interface RepositorySettingsResponse {
  repository: string;
  settings: RepositorySettings;
  using_defaults: boolean;
  message?: string;
}

interface IndexingSettingsProps {
  repositoryPath: string;
}

export function IndexingSettings({ repositoryPath }: IndexingSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalIndexingSettings | null>(null);
  const [repoSettings, setRepoSettings] = useState<RepositorySettings>({});
  const [isUsingDefaults, setIsUsingDefaults] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [dirInput, setDirInput] = useState('');
  const [patternInput, setPatternInput] = useState('');
  const [extensionInput, setExtensionInput] = useState('');
  const [activeTab, setActiveTab] = useState('directories');
  
  // Load settings when the component opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, repositoryPath]);
  
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Load global settings
      const globalResponse = await fetch('/api/settings/indexing');
      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        setGlobalSettings(globalData);
      }
      
      // Load repository specific settings
      const repoResponse = await fetch(`/api/settings/repository/${encodeURIComponent(repositoryPath)}`);
      if (repoResponse.ok) {
        const repoData: RepositorySettingsResponse = await repoResponse.json();
        setIsUsingDefaults(repoData.using_defaults);
        if (!repoData.using_defaults) {
          setRepoSettings(repoData.settings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/settings/repository/${encodeURIComponent(repositoryPath)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(repoSettings),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Settings saved:', data);
        setIsUsingDefaults(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetToDefaults = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/settings/repository/${encodeURIComponent(repositoryPath)}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setRepoSettings({});
        setIsUsingDefaults(true);
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to add to string array settings
  const addToArray = (key: keyof RepositorySettings, value: string) => {
    if (!value.trim()) return;
    
    setRepoSettings(prev => {
      const currentArray = prev[key] as string[] || [];
      if (!currentArray.includes(value)) {
        return {
          ...prev,
          [key]: [...currentArray, value],
        };
      }
      return prev;
    });
  };
  
  // Helper to remove from string array settings
  const removeFromArray = (key: keyof RepositorySettings, value: string) => {
    setRepoSettings(prev => {
      const currentArray = prev[key] as string[] || [];
      return {
        ...prev,
        [key]: currentArray.filter(item => item !== value),
      };
    });
  };
  
  // Handle Directory inputs
  const handleAddIncludeDir = () => {
    addToArray('include_dirs', dirInput);
    setDirInput('');
  };
  
  const handleAddExcludeDir = () => {
    addToArray('exclude_dirs', dirInput);
    setDirInput('');
  };
  
  // Handle Pattern inputs
  const handleAddPattern = () => {
    addToArray('ignore_patterns', patternInput);
    setPatternInput('');
  };
  
  // Handle Extension inputs
  const handleAddExtension = () => {
    addToArray('supported_extensions', extensionInput);
    setExtensionInput('');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Settings className="h-4 w-4 mr-2" />
          Indexing Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Repository Indexing Settings</DialogTitle>
          <DialogDescription>
            Configure which files and directories should be indexed for this repository.
            {isUsingDefaults && " Currently using global default settings."}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800" />
            <span className="ml-2">Loading settings...</span>
          </div>
        ) : (
          <>
            <div className="py-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="directories">Directories</TabsTrigger>
                  <TabsTrigger value="patterns">File Patterns</TabsTrigger>
                  <TabsTrigger value="size">Size Limits</TabsTrigger>
                </TabsList>
                
                <TabsContent value="directories" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Include Only These Directories</h3>
                      <p className="text-xs text-muted-foreground">
                        Only index directories in this list. Leave empty to index all directories except excluded ones.
                      </p>
                      
                      <div className="flex gap-2">
                        <Input 
                          value={dirInput}
                          onChange={(e) => setDirInput(e.target.value)}
                          placeholder="src"
                          className="flex-1"
                        />
                        <Button onClick={handleAddIncludeDir} size="sm">Add</Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {repoSettings.include_dirs?.map(dir => (
                          <Badge 
                            key={dir} 
                            variant="outline"
                            className="px-2 py-1 cursor-pointer hover:bg-secondary"
                            onClick={() => removeFromArray('include_dirs', dir)}
                          >
                            {dir} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Exclude Directories</h3>
                      <p className="text-xs text-muted-foreground">
                        Skip these directories during indexing.
                      </p>
                      
                      <div className="flex gap-2">
                        <Input 
                          value={dirInput}
                          onChange={(e) => setDirInput(e.target.value)}
                          placeholder="node_modules"
                          className="flex-1"
                        />
                        <Button onClick={handleAddExcludeDir} size="sm">Add</Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {repoSettings.exclude_dirs?.map(dir => (
                          <Badge 
                            key={dir} 
                            variant="outline"
                            className="px-2 py-1 cursor-pointer hover:bg-secondary"
                            onClick={() => removeFromArray('exclude_dirs', dir)}
                          >
                            {dir} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="global-dirs">
                        <AccordionTrigger>Global Default Directories to Skip</AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {globalSettings?.skip_directories.map(dir => (
                              <Badge key={dir} variant="secondary" className="px-2 py-1">
                                {dir}
                              </Badge>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </TabsContent>
                
                <TabsContent value="patterns" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Ignore File Patterns</h3>
                      <p className="text-xs text-muted-foreground">
                        Skip files matching these glob patterns.
                      </p>
                      
                      <div className="flex gap-2">
                        <Input 
                          value={patternInput}
                          onChange={(e) => setPatternInput(e.target.value)}
                          placeholder="*.min.js"
                          className="flex-1"
                        />
                        <Button onClick={handleAddPattern} size="sm">Add</Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {repoSettings.ignore_patterns?.map(pattern => (
                          <Badge 
                            key={pattern} 
                            variant="outline"
                            className="px-2 py-1 cursor-pointer hover:bg-secondary"
                            onClick={() => removeFromArray('ignore_patterns', pattern)}
                          >
                            {pattern} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Supported File Extensions</h3>
                      <p className="text-xs text-muted-foreground">
                        Only index files with these extensions.
                      </p>
                      
                      <div className="flex gap-2">
                        <Input 
                          value={extensionInput}
                          onChange={(e) => setExtensionInput(e.target.value)}
                          placeholder=".py"
                          className="flex-1"
                        />
                        <Button onClick={handleAddExtension} size="sm">Add</Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {repoSettings.supported_extensions?.map(ext => (
                          <Badge 
                            key={ext} 
                            variant="outline"
                            className="px-2 py-1 cursor-pointer hover:bg-secondary"
                            onClick={() => removeFromArray('supported_extensions', ext)}
                          >
                            {ext} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="global-patterns">
                        <AccordionTrigger>Global Default File Patterns to Ignore</AccordionTrigger>
                        <AccordionContent>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {globalSettings?.ignore_patterns.map(pattern => (
                              <Badge key={pattern} variant="secondary" className="px-2 py-1">
                                {pattern}
                              </Badge>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </TabsContent>
                
                <TabsContent value="size" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">File Size Limit</h3>
                      <p className="text-xs text-muted-foreground">
                        Skip files larger than this size (in MB).
                      </p>
                      
                      <div className="flex items-center gap-4">
                        <Input 
                          type="number"
                          value={repoSettings.max_file_size_mb || globalSettings?.max_file_size_mb || 10}
                          onChange={(e) => setRepoSettings({...repoSettings, max_file_size_mb: parseInt(e.target.value)})}
                          min={1}
                          max={100}
                          className="w-24"
                        />
                        <span>MB</span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Default: {globalSettings?.max_file_size_mb || 10} MB
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Global Size Limits</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium">Max Repository Size</p>
                          <p className="text-lg">{globalSettings?.max_repository_size_gb || 2} GB</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Max Files Per Repository</p>
                          <p className="text-lg">{globalSettings?.max_files_per_repository || 10000}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={resetToDefaults} disabled={isLoading || isUsingDefaults}>
            Reset to Defaults
          </Button>
          <Button onClick={saveSettings} disabled={isLoading}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 