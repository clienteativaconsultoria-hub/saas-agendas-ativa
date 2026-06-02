path = 'src/pages/Schedule.tsx'
with open(path, 'r') as f: content = f.read()

content = content.replace("isOccupied ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'", "isOccupied ? 'bg-primary-500' : 'bg-navy-200'")
content = content.replace('stat.occupancy >= 80 ? "bg-red-500" : stat.occupancy >= 50 ? "bg-amber-400" : "bg-emerald-500"', 'stat.occupancy >= 80 ? "bg-primary-600" : stat.occupancy >= 50 ? "bg-primary-500" : "bg-navy-300"')
content = content.replace('stat.occupancy >= 80 ? "text-red-600" : stat.occupancy >= 50 ? "text-amber-600" : "text-emerald-600"', 'stat.occupancy >= 80 ? "text-primary-700" : stat.occupancy >= 50 ? "text-primary-600" : "text-navy-600"')

with open(path, 'w') as f: f.write(content)
