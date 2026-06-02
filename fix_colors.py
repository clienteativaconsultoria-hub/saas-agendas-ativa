import os
import re

files_to_check = [
    "src/pages/Dashboard.tsx",
    "src/components/StrategicDashboard.tsx",
    "src/pages/Schedule.tsx",
    "src/pages/Projects.tsx",
    "src/pages/Requests.tsx"
]

def replace_in_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        content = f.read()

    # Dashboard.tsx
    content = content.replace("color: 'text-amber-300'", "color: 'text-primary-300'")
    content = content.replace("color: 'text-purple-300'", "color: 'text-primary-300'")
    
    content = content.replace("iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    content = content.replace("iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    content = content.replace("iconBg: 'bg-primary-50', iconColor: 'text-primary-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    
    content = content.replace("bg-purple-50 flex", "bg-navy-50 flex")
    content = content.replace("text-purple-500", "text-primary-500")
    content = content.replace("bg-purple-100 text-purple-700", "bg-navy-100 text-navy-700")

    # StrategicDashboard.tsx
    content = content.replace("iconBg: 'bg-primary-50', iconColor: 'text-primary-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    content = content.replace("iconBg: 'bg-amber-50', iconColor: 'text-amber-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    content = content.replace("iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    content = content.replace("iconBg: 'bg-purple-50', iconColor: 'text-purple-600'", "iconBg: 'bg-navy-50', iconColor: 'text-primary-600'")
    
    content = content.replace("const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#0ea5e9', '#6366f1', '#64748b'];", "const CHART_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1e40af', '#2563eb', '#1d4ed8', '#1e3a8a'];")
    content = content.replace("fill={entry.allocation >= 100 ? '#f43f5e' : entry.allocation >= 80 ? '#f59e0b' : '#3b82f6'}", "fill={entry.allocation >= 100 ? '#1e3a8a' : entry.allocation >= 80 ? '#60a5fa' : '#3b82f6'}")
    content = content.replace("stroke=\"#10b981\"", "stroke=\"#93c5fd\"")
    content = content.replace("fill=\"url(#colorLogs)\" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}", "fill=\"url(#colorLogs)\" dot={{ r: 4, fill: '#93c5fd', strokeWidth: 2, stroke: '#fff' }}")
    content = content.replace("stopColor=\"#10b981\"", "stopColor=\"#93c5fd\"")

    # Schedule.tsx
    content = content.replace("color: 'text-primary-600', bg: 'bg-primary-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-amber-600', bg: 'bg-amber-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-emerald-600', bg: 'bg-emerald-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-purple-600', bg: 'bg-purple-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("fill={['#3b82f6', '#f59e0b', '#10b981', '#f43f5e'][index % 4]}", "fill={['#1e3a8a', '#3b82f6', '#60a5fa', '#bfdbfe'][index % 4]}")
    content = content.replace("fill={['#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b'][index % 5]}", "fill={['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'][index % 5]}")

    # Projects.tsx
    content = content.replace("color: 'text-primary-600', bg: 'bg-primary-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-amber-600', bg: 'bg-amber-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-indigo-600', bg: 'bg-indigo-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")

    # Requests.tsx
    content = content.replace("color: 'text-navy-600',    bg: 'bg-navy-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-amber-600',   bg: 'bg-amber-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-emerald-600', bg: 'bg-emerald-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")
    content = content.replace("color: 'text-red-500',     bg: 'bg-red-50'", "color: 'text-primary-600', bg: 'bg-navy-50'")

    with open(filepath, 'w') as f:
        f.write(content)

for f in files_to_check:
    replace_in_file(f)

print("Colors standardized.")
