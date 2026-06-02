import os

path = 'src/pages/Schedule.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Visão Geral de Disponibilidade (Month view list)
old_visao = """                           {/* Tabela de Consultores */}
                           <div className="grid grid-cols-[1fr_80px_80px_80px_1fr] gap-2 px-5 py-3.5 table-header border-t-0">
                              <div className="text-left font-bold text-[10px] uppercase tracking-wider text-navy-500">Consultor</div>
                              <div className="text-center font-bold text-[10px] uppercase tracking-wider text-navy-500">Ocupados</div>
                              <div className="text-center font-bold text-[10px] uppercase tracking-wider text-navy-500">Livres</div>
                              <div className="text-center font-bold text-[10px] uppercase tracking-wider text-navy-500">Ocupação</div>
                              <div className="text-left font-bold text-[10px] uppercase tracking-wider text-navy-500 pl-4">Distribuição</div>
                           </div>

                           <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                              {consultantStats.map(stat => ("""

new_visao = """                           {/* Tabela de Consultores */}
                           <div className="overflow-x-auto custom-scrollbar flex-1 bg-white">
                              <div className="min-w-[800px]">
                                 <div className="grid grid-cols-[1fr_80px_80px_80px_1fr] gap-2 px-5 py-3.5 table-header border-t-0 sticky top-0 z-10">
                                    <div className="text-left font-bold text-[10px] uppercase tracking-wider text-navy-500">Consultor</div>
                                    <div className="text-center font-bold text-[10px] uppercase tracking-wider text-navy-500">Ocupados</div>
                                    <div className="text-center font-bold text-[10px] uppercase tracking-wider text-navy-500">Livres</div>
                                    <div className="text-center font-bold text-[10px] uppercase tracking-wider text-navy-500">Ocupação</div>
                                    <div className="text-left font-bold text-[10px] uppercase tracking-wider text-navy-500 pl-4">Distribuição</div>
                                 </div>

                                 <div className="bg-white pb-4">
                                    {consultantStats.map(stat => ("""
content = content.replace(old_visao, new_visao)

# Now close the divs for Month View list
old_visao_end = """                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>"""
new_visao_end = """                                    </div>
                                 </div>
                              ))}
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>"""
content = content.replace(old_visao_end, new_visao_end)


# 2. Grid View
old_grid = """        ) : viewMode === 'grid' ? (
        <div className='flex-1 card overflow-hidden flex flex-col'>
           
           {/* Table Header */}
           <div className='flex overflow-hidden border-b border-navy-200 bg-navy-50/90 z-20'>
               <div className='w-64 shrink-0 p-3 font-bold text-[11px] text-navy-500 uppercase tracking-widest border-r border-navy-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-20 bg-white/50 backdrop-blur-md'>
                 Consultor
               </div>
               
               <div className='flex-1 overflow-x-auto custom-scrollbar flex'>
                  {timeView === 'month' ? (
                     <div className='p-3 w-full text-center font-semibold text-xs text-navy-500 uppercase tracking-wider'>
                       Resumo de Disponibilidade ({format(currentDate, 'MMMM', { locale: ptBR })})
                     </div>
                  ) : (
                    timeColumns.map((date, idx) => {
                      const isToday = isSameDay(date, new Date());
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      
                      return (
                      <div key={idx} className={clsx(
                        'border-r border-navy-200 p-2 text-center box-border shrink-0 transition-colors',
                        isToday ? 'bg-primary-50/50 relative' : isWeekend ? 'bg-slate-50' : 'bg-navy-50',
                        timeView === 'week' ? 'w-32' : 'w-24'
                      )}>
                         {isToday && (
                           <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-primary-500 rounded-r-full h-full"></div>
                         )}
                         <div className={clsx('text-xs font-semibold', isToday ? 'text-primary-700' : 'text-navy-700')}>
                           {format(date, 'dd MMM', { locale: ptBR })}
                         </div>
                         <div className='text-[10px] text-navy-400 font-medium capitalize'>
                           {format(date, 'EEEE', { locale: ptBR }).split('-')[0]}
                         </div>
                      </div>
                    )})
                  )}
               </div>
           </div>

           {/* Table Body */}
           <div className='overflow-y-auto overflow-x-auto flex-1 custom-scrollbar'>
              <div className='min-w-max w-full'>
                 {filteredConsultants.map(consultant => {"""

new_grid = """        ) : viewMode === 'grid' ? (
        <div className='flex-1 card overflow-hidden flex flex-col'>
           <div className='overflow-auto flex-1 custom-scrollbar relative'>
              <div className='min-w-max w-full'>
                 {/* Table Header */}
                 <div className='flex border-b border-navy-200 bg-navy-50/90 z-30 sticky top-0 backdrop-blur-md'>
                     <div className='w-40 md:w-64 shrink-0 p-3 font-bold text-[11px] text-navy-500 uppercase tracking-widest border-r border-navy-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] sticky left-0 z-40 bg-navy-50/90 backdrop-blur-md'>
                       Consultor
                     </div>
                     
                     <div className='flex-1 flex'>
                        {timeView === 'month' ? (
                           <div className='p-3 w-full text-center font-semibold text-xs text-navy-500 uppercase tracking-wider'>
                             Resumo de Disponibilidade ({format(currentDate, 'MMMM', { locale: ptBR })})
                           </div>
                        ) : (
                          timeColumns.map((date, idx) => {
                            const isToday = isSameDay(date, new Date());
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            
                            return (
                            <div key={idx} className={clsx(
                              'border-r border-navy-200 p-2 text-center box-border shrink-0 transition-colors',
                              isToday ? 'bg-primary-50/50 relative' : isWeekend ? 'bg-slate-50' : 'bg-navy-50',
                              timeView === 'week' ? 'w-32' : 'w-24'
                            )}>
                               {isToday && (
                                 <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-primary-500 rounded-r-full h-full"></div>
                               )}
                               <div className={clsx('text-xs font-semibold', isToday ? 'text-primary-700' : 'text-navy-700')}>
                                 {format(date, 'dd MMM', { locale: ptBR })}
                               </div>
                               <div className='text-[10px] text-navy-400 font-medium capitalize'>
                                 {format(date, 'EEEE', { locale: ptBR }).split('-')[0]}
                               </div>
                            </div>
                          )})
                        )}
                     </div>
                 </div>

                 {/* Table Body */}
                 {filteredConsultants.map(consultant => {"""
content = content.replace(old_grid, new_grid)

# Adjust width of Consultor column in Table Body (from w-64 to w-40 md:w-64)
old_grid_body_col = """                      {/* Name Column */}
                      <div 
                         onClick={() => { setSelectedConsultantId(consultant.id); setTimeView('month'); }}
                         className='w-64 shrink-0 sticky left-0 z-10 bg-white group-hover:bg-navy-50/30 border-r border-navy-200 p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-navy-50 transition-colors'
                      >"""
new_grid_body_col = """                      {/* Name Column */}
                      <div 
                         onClick={() => { setSelectedConsultantId(consultant.id); setTimeView('month'); }}
                         className='w-40 md:w-64 shrink-0 sticky left-0 z-20 bg-white group-hover:bg-navy-50/30 border-r border-navy-200 p-2 md:p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-navy-50 transition-colors'
                      >"""
content = content.replace(old_grid_body_col, new_grid_body_col)

# Truncate text for consultant names on mobile
old_consultant_name = """                           <div className='overflow-hidden'>
                             <div className='text-sm font-bold text-navy-900 truncate'>{consultant.name}</div>
                             <div className='text-[10px] text-navy-400 font-semibold mt-0.5 truncate uppercase tracking-wider'>{consultant.role || 'Consultor'}</div>
                           </div>"""
new_consultant_name = """                           <div className='overflow-hidden'>
                             <div className='text-xs md:text-sm font-bold text-navy-900 truncate'>{consultant.name}</div>
                             <div className='text-[9px] md:text-[10px] text-navy-400 font-semibold mt-0.5 truncate uppercase tracking-wider'>{consultant.role || 'Consultor'}</div>
                           </div>"""
content = content.replace(old_consultant_name, new_consultant_name)

# Close the div for Grid View body
old_grid_end = """                 })}
              </div>
           </div>
        </div>
        ) : ("""
new_grid_end = """                 })}
              </div>
           </div>
        </div>
        ) : ("""
content = content.replace(old_grid_end, new_grid_end)


with open(path, 'w') as f:
    f.write(content)
print("done")
