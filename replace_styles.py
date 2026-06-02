import os
import re

target_dir = "/Users/andreimagagna/Futuree/Clientes/Agendas Ativa/src/pages"
files_to_process = [os.path.join(target_dir, f) for f in os.listdir(target_dir) if f.endswith(".tsx")]

card_pattern_1 = re.compile(r'bg-white\s+(p-\d+)?\s*rounded-(?:xl|2xl|lg)\s+border\s+border-navy-100\s+shadow-sm')
card_pattern_2 = re.compile(r'bg-white\s+rounded-(?:xl|2xl|lg)\s+shadow-sm\s+border\s+border-navy-100')
card_pattern_3 = re.compile(r'bg-white\s+rounded-(?:xl|2xl|lg)\s+border\s+border-navy-100\s+(p-\d+)?\s*shadow-sm')
card_pattern_4 = re.compile(r'bg-white\s+p-\d+\s+rounded-(?:xl|2xl|lg)\s+shadow-sm\s+border\s+border-navy-100')

def replace_card(match):
    p_group = match.group(1)
    if p_group:
        return f"card {p_group}"
    return "card"

for fp in files_to_process:
    with open(fp, "r") as f:
        content = f.read()
    
    # Cards
    content = card_pattern_1.sub(replace_card, content)
    content = card_pattern_2.sub("card", content)
    content = card_pattern_3.sub(replace_card, content)
    content = card_pattern_4.sub("card", content)

    # Some specifics
    content = content.replace("bg-white rounded-xl shadow-2xl", "card shadow-2xl")
    content = content.replace("bg-white p-6 rounded-2xl shadow-sm border border-navy-100", "card p-6")
    content = content.replace("bg-white rounded-2xl shadow-sm border border-navy-200", "card")
    content = content.replace("bg-white rounded-lg p-4 border border-navy-200 space-y-4 shadow-sm", "card p-4 space-y-4")
    content = content.replace("bg-white rounded-lg p-4 border border-navy-200 space-y-3 shadow-sm", "card p-4 space-y-3")
    
    # Inputs
    content = content.replace("w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border bg-white", "input w-full bg-white")
    content = content.replace("w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2.5 border", "input w-full")
    content = content.replace("w-full rounded-lg border-navy-300 shadow-sm focus:border-primary-500 text-sm p-2 border", "input w-full")
    content = content.replace("w-full pl-10 pr-4 py-2 border border-navy-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 outline-none transition-all shadow-sm", "input w-full pl-10")
    content = content.replace("w-full pl-10 pr-4 py-2.5 bg-white border border-navy-200 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 outline-none transition-all shadow-sm", "input w-full pl-10")
    
    # Buttons
    content = re.sub(r'px-4\s+py-2\s+bg-primary-600\s+hover:bg-primary-700\s+text-white\s+rounded-lg\s+font-medium\s+shadow-sm\s+transition-colors', 'btn-primary', content)
    content = re.sub(r'px-4\s+py-2\s+bg-primary-600\s+hover:bg-primary-700\s+text-white\s+rounded-md\s+transition-colors', 'btn-primary', content)
    content = re.sub(r'flex\s+items-center\s+justify-center\s+gap-2\s+px-4\s+py-2\s+bg-primary-600\s+hover:bg-primary-700\s+text-white\s+rounded-lg\s+font-medium\s+transition-colors', 'btn-primary', content)
    content = re.sub(r'flex\s+items-center\s+gap-2\s+px-6\s+py-2\.5\s+bg-primary-600\s+hover:bg-primary-700\s+text-white\s+font-medium\s+rounded-lg\s+transition-colors\s+shadow-lg\s+shadow-primary-900/20', 'btn-primary px-6', content)
    content = re.sub(r'px-4\s+py-2\.5\s+border\s+border-navy-300\s+text-navy-700\s+font-medium\s+rounded-lg\s+hover:bg-navy-50\s+transition-colors', 'btn-secondary', content)
    content = re.sub(r'w-full\s+bg-primary-600\s+text-white\s+py-2\s+rounded-lg\s+hover:bg-primary-700\s+transition-colors\s+font-medium', 'btn-primary w-full py-2', content)
    content = re.sub(r'w-full\s+bg-primary-600\s+text-white\s+py-2\.5\s+rounded-xl\s+font-medium\s+hover:bg-primary-700\s+transition-colors\s+shadow-sm\s+hover:shadow-md', 'btn-primary w-full', content)
    
    with open(fp, "w") as f:
        f.write(content)

print("Done")
