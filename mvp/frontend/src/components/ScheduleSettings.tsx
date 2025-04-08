import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, Calendar, Clock, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleSettingsProps {
  repoPath: string;
}

const formSchema = z.object({
  scheduleType: z.enum(['none', 'hourly', 'daily', 'weekly']),
  timeValue: z.string().optional(),
  dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function ScheduleSettings({ repoPath }: ScheduleSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scheduleType: 'none',
      timeValue: '00:00',
      dayOfWeek: 'monday',
    },
  });

  // Fetch current schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/indexing-schedule?repo_path=${encodeURIComponent(repoPath)}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch schedule');
        }
        
        const data = await response.json();
        setCurrentSchedule(data);
        
        // Update form values with current schedule
        if (data.has_schedule && data.schedule) {
          form.setValue('scheduleType', data.schedule.type);
          
          if (data.schedule.time) {
            form.setValue('timeValue', data.schedule.time);
          }
          
          if (data.schedule.day) {
            form.setValue('dayOfWeek', data.schedule.day);
          }
        }
      } catch (error) {
        console.error('Error fetching schedule:', error);
        toast.error('Failed to load schedule settings');
      } finally {
        setLoading(false);
      }
    };

    if (repoPath) {
      fetchSchedule();
    }
  }, [repoPath, form]);

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    try {
      setSaving(true);
      
      const payload: any = {
        repo_path: repoPath,
        schedule_type: values.scheduleType,
      };
      
      if (values.scheduleType === 'daily' || values.scheduleType === 'weekly') {
        payload.time_value = values.timeValue;
      }
      
      if (values.scheduleType === 'weekly') {
        payload.day_of_week = values.dayOfWeek;
      }
      
      const response = await fetch('/api/schedule-indexing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save schedule');
      }
      
      const result = await response.json();
      setCurrentSchedule({
        has_schedule: values.scheduleType !== 'none',
        schedule: result.schedule,
      });
      
      toast.success('Indexing schedule updated successfully');
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to update schedule settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle form rendering based on schedule type
  const watchScheduleType = form.watch('scheduleType');

  const renderNextRunTime = () => {
    if (!currentSchedule || !currentSchedule.has_schedule) {
      return <p className="text-sm text-muted-foreground">No scheduled indexing</p>;
    }

    const schedule = currentSchedule.schedule;
    let nextRunText = '';

    switch (schedule.type) {
      case 'hourly':
        nextRunText = 'Runs every hour';
        break;
      case 'daily':
        nextRunText = `Runs daily at ${schedule.time}`;
        break;
      case 'weekly':
        nextRunText = `Runs every ${schedule.day} at ${schedule.time}`;
        break;
      default:
        return <p className="text-sm text-muted-foreground">No scheduled indexing</p>;
    }

    return (
      <div className="flex items-center text-sm text-muted-foreground">
        <Clock className="mr-2 h-4 w-4" />
        <span>{nextRunText}</span>
      </div>
    );
  };

  // Reindex repository now
  const handleReindexNow = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/index-repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_path: repoPath,
          clear_existing: false,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start indexing');
      }
      
      toast.success('Re-indexing started');
    } catch (error) {
      console.error('Error starting indexing:', error);
      toast.error('Failed to start re-indexing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="dark:gradient-card">
        <CardHeader>
          <CardTitle>Indexing Schedule</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:gradient-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Indexing Schedule</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReindexNow}
            disabled={saving}
            className="dark:gradient-button"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCw className="h-4 w-4 mr-2" />}
            Re-index Now
          </Button>
        </CardTitle>
        <CardDescription>Configure when this codebase should be automatically indexed</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="scheduleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schedule Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select schedule type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No scheduled indexing</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchScheduleType === 'daily' || watchScheduleType === 'weekly' ? (
              <FormField
                control={form.control}
                name="timeValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {watchScheduleType === 'weekly' ? (
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monday">Monday</SelectItem>
                        <SelectItem value="tuesday">Tuesday</SelectItem>
                        <SelectItem value="wednesday">Wednesday</SelectItem>
                        <SelectItem value="thursday">Thursday</SelectItem>
                        <SelectItem value="friday">Friday</SelectItem>
                        <SelectItem value="saturday">Saturday</SelectItem>
                        <SelectItem value="sunday">Sunday</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="pt-2">
              {renderNextRunTime()}
            </div>

            <Button type="submit" disabled={saving} className="w-full dark:gradient-button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Schedule
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
} 