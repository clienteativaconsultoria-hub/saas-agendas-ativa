import os

path = 'src/pages/Schedule.tsx'
with open(path, 'r') as f:
    content = f.read()

# Action Bar modification
old_action_bar = """          {/* Action Bar */}
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
             <div className='flex items-center gap-2'>
                 <div className='flex items-center bg-navy-50 rounded-xl p-1 border border-navy-100 shadow-inner'>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={clsx(
                        'p-2.5 rounded-lg transition-all', 
                        viewMode === 'list' 
                          ? 'bg-white text-navy-900 shadow-sm' 
                          : 'text-navy-500 hover:text-navy-700'
                      )}
                      title="Visão Geral"
                    >
                      <Eye className='w-4 h-4' />
                    </button>
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={clsx(
                        'p-2.5 rounded-lg transition-all', 
                        viewMode === 'grid' 
                          ? 'bg-white text-navy-900 shadow-sm' 
                          : 'text-navy-500 hover:text-navy-700'
                      )}
                      title="Grade de Alocação"
                    >
                      <LayoutGrid className='w-4 h-4' />
                    </button>
                 </div>

                 <div className='flex items-center bg-navy-50 rounded-xl p-1 border border-navy-100 shadow-inner mr-2'>
                    {(['day', 'week', 'month'] as const).map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setTimeView(mode)}
                        className={clsx(
                          'px-4 py-2 text-sm font-semibold rounded-lg transition-all', 
                          timeView === mode 
                            ? 'bg-white text-navy-900 shadow-sm' 
                            : 'text-navy-500 hover:text-navy-700'
                        )}
                      >
                        {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                      </button>
                    ))}
                 </div>

                 {/* Date Navigation */}
                 <div className='flex items-center bg-white border border-navy-100 rounded-xl shadow-sm p-1 gap-1'>
                    <div className='flex items-center gap-1 border-r border-navy-100 pr-2 mr-2 pl-1'>
                       <button onClick={() => setCurrentDate(new Date())} className='btn-ghost px-3 py-1.5 font-semibold text-navy-700'>Hoje</button>
                    </div>
                    
                    <button onClick={handlePrevDate} className='p-1.5 hover:bg-navy-50 rounded-lg text-navy-400 hover:text-navy-900 transition-colors'>
                      <ChevronLeft className='w-5 h-5' />
                    </button>
                    <span className='font-extrabold text-navy-950 min-w-[200px] text-center text-sm px-2 tracking-tight'>
                       {timeView === 'day' && 'Próximos 7 dias'}
                       {timeView === 'week' && `${format(timeColumns[0], 'dd MMM', { locale: ptBR })} - ${format(timeColumns[timeColumns.length-1], 'dd MMM yyyy', { locale: ptBR })}`}
                       {timeView === 'month' && format(currentDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
                    </span>
                    <button onClick={handleNextDate} className='p-1.5 hover:bg-navy-50 rounded-lg text-navy-400 hover:text-navy-900 transition-colors'>
                      <ChevronRight className='w-5 h-5' />
                    </button>
                 </div>
              </div>

              {/* Right: Actions & Filters */}
              <div className='flex flex-wrap items-center justify-end gap-3'>
                 <div className='flex items-center gap-2 border-r border-navy-100 pr-3 mr-1'>
                   <button 
                    onClick={() => setShowFilter(!showFilter)} 
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all group', 
                      showFilter ? 'bg-navy-100 text-primary-700 ring-1 ring-navy-200' : 'hover:bg-navy-50 text-navy-600'
                    )}
                   >
                     <Filter className={clsx('w-4 h-4', showFilter ? 'text-primary-600' : 'text-navy-400 group-hover:text-navy-600')} /> 
                     <span>Filtros</span>
                     {(filterText || selectedProjectFilter !== 'all' || selectedManagerFilter !== 'all') && (
                        <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                     )}
                   </button>
                 </div>

                 {userRole === 'ADM' && (
                   <button 
                    onClick={() => setShowRequestsPanel(!showRequestsPanel)}
                    className={clsx(
                      'relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm',
                      showRequestsPanel 
                        ? 'bg-primary-50 text-primary-700 border-primary-200' 
                        : 'bg-white hover:bg-navy-50 text-navy-700 border-navy-200'
                    )}
                    title="Solicitações de Alteração"
                  >
                     <Bell className='w-4 h-4' />
                     <span className='hidden sm:inline'>Solicitações</span>
                     {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
                       <span className='absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse'>
                         {pendingRequests.filter(r => r.status === 'pending').length}
                       </span>
                     )}
                  </button>
                 )}

                 {/* Consultant: My Requests Bell + Solicitar Alteração button */}
                 {userRole !== 'ADM' && (
                   <>
                     <button
                       onClick={() => { setShowMyRequestsPanel(!showMyRequestsPanel); fetchMyRequests(); }}
                       className={clsx(
                         'relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm',
                         showMyRequestsPanel
                           ? 'bg-primary-50 text-primary-700 border-primary-200'
                           : 'bg-white hover:bg-navy-50 text-navy-700 border-navy-200'
                       )}
                       title="Minhas Solicitações de Alteração"
                     >
                       <Bell className='w-4 h-4' />
                       <span className='hidden sm:inline'>Minhas Solicitações</span>
                       {myRequests.filter(r => r.status === 'pending').length > 0 && (
                         <span className='absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-navy-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse'>
                           {myRequests.filter(r => r.status === 'pending').length}
                         </span>
                       )}
                     </button>
                     <button
                       onClick={() => { setSolicitacaoModalTab('alterar'); setShowSolicitacaoModal(true); }}
                       className='flex items-center gap-2 btn-primary bg-primary-600 transition-colors shadow-sm'
                       title="Solicitar Alteração de Agenda"
                     >
                       <MessageSquarePlus className='w-4 h-4' />
                       <span className='hidden sm:inline'>Solicitar Alteração</span>
                     </button>
                   </>
                 )}

                 {userRole === 'ADM' && (
                   <>
                     <button 
                      onClick={() => setShowReportModal(true)}
                      className='flex items-center gap-2 px-3 py-2 btn-secondary transition-colors shadow-sm'
                      title="Relatório de Bordo"
                    >
                       <ClipboardList className='w-4 h-4' /> <span className='hidden sm:inline'>Relatório</span>
                    </button>

                     <button
                      onClick={() => setShowBulkModal(true)}
                      className='flex items-center gap-2 px-3 py-2 btn-secondary transition-colors shadow-sm'
                      title="Editar agendas em massa"
                    >
                       <Layers className='w-4 h-4' /> <span className='hidden sm:inline'>Em massa</span>
                    </button>

                     <button
                      onClick={() => setShowModal(true)}
                      className='flex items-center gap-2 px-3 py-2 btn-primary transition-colors shadow-sm'
                    >
                      <Plus className='w-4 h-4' /> Novo
                    </button>
                   </>
                 )}
              </div>
           </div> {/* End of Top Flex Actions */}"""

new_action_bar = """          {/* Action Bar */}
          <div className='flex flex-col lg:flex-row justify-between gap-3'>
             
             {/* Left: View & Date Switchers */}
             <div className='flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto'>
                 <div className='flex items-center gap-2 w-full sm:w-auto'>
                    <div className='flex items-center bg-navy-50 rounded-lg p-1 border border-navy-100 shadow-inner flex-1 sm:flex-none justify-center'>
                      <button 
                        onClick={() => setViewMode('list')}
                        className={clsx(
                          'p-2.5 rounded-md transition-all flex-1 sm:flex-none flex justify-center', 
                          viewMode === 'list' 
                            ? 'bg-white text-navy-900 shadow-sm' 
                            : 'text-navy-500 hover:text-navy-700'
                        )}
                        title="Visão Geral"
                      >
                        <Eye className='w-4 h-4' />
                      </button>
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                          'p-2.5 rounded-md transition-all flex-1 sm:flex-none flex justify-center', 
                          viewMode === 'grid' 
                            ? 'bg-white text-navy-900 shadow-sm' 
                            : 'text-navy-500 hover:text-navy-700'
                        )}
                        title="Grade de Alocação"
                      >
                        <LayoutGrid className='w-4 h-4' />
                      </button>
                    </div>

                    <div className='flex items-center bg-navy-50 rounded-lg p-1 border border-navy-100 shadow-inner flex-1 sm:flex-none justify-center'>
                      {(['day', 'week', 'month'] as const).map(mode => (
                        <button 
                          key={mode}
                          onClick={() => setTimeView(mode)}
                          className={clsx(
                            'px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all flex-1 sm:flex-none', 
                            timeView === mode 
                              ? 'bg-white text-navy-900 shadow-sm' 
                              : 'text-navy-500 hover:text-navy-700'
                          )}
                        >
                          {mode === 'day' ? 'Dia' : mode === 'week' ? 'Sem.' : 'Mês'}
                        </button>
                      ))}
                    </div>
                 </div>

                 {/* Date Navigation */}
                 <div className='flex items-center bg-white border border-navy-100 rounded-lg shadow-sm p-1 gap-1 w-full sm:w-auto justify-between sm:justify-start'>
                    <button onClick={() => setCurrentDate(new Date())} className='btn-ghost px-3 py-1.5 font-semibold text-navy-700 text-sm'>
                       Hoje
                    </button>
                    <div className="w-px h-5 bg-navy-100 mx-1 hidden sm:block"></div>
                    <div className="flex items-center gap-1">
                       <button onClick={handlePrevDate} className='p-1.5 hover:bg-navy-50 rounded-lg text-navy-400 hover:text-navy-900 transition-colors'>
                         <ChevronLeft className='w-5 h-5' />
                       </button>
                       <span className='font-extrabold text-navy-950 sm:min-w-[160px] text-center text-xs sm:text-sm px-1 tracking-tight truncate'>
                          {timeView === 'day' && 'Próximos 7 dias'}
                          {timeView === 'week' && `${format(timeColumns[0], 'dd MMM', { locale: ptBR })} - ${format(timeColumns[timeColumns.length-1], 'dd MMM', { locale: ptBR })}`}
                          {timeView === 'month' && format(currentDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase()}
                       </span>
                       <button onClick={handleNextDate} className='p-1.5 hover:bg-navy-50 rounded-lg text-navy-400 hover:text-navy-900 transition-colors'>
                         <ChevronRight className='w-5 h-5' />
                       </button>
                    </div>
                 </div>
              </div>

              {/* Right: Actions & Filters (Scrollable horizontally on mobile) */}
              <div className='flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 -mb-1 custom-scrollbar shrink-0 whitespace-nowrap'>
                 <button 
                  onClick={() => setShowFilter(!showFilter)} 
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all group shrink-0', 
                    showFilter ? 'bg-navy-100 text-primary-700 ring-1 ring-navy-200' : 'hover:bg-navy-50 text-navy-600 bg-white border border-navy-200'
                  )}
                 >
                   <Filter className={clsx('w-4 h-4', showFilter ? 'text-primary-600' : 'text-navy-400 group-hover:text-navy-600')} /> 
                   <span>Filtros</span>
                   {(filterText || selectedProjectFilter !== 'all' || selectedManagerFilter !== 'all') && (
                      <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                   )}
                 </button>

                 <div className="w-px h-6 bg-navy-200 mx-1 shrink-0"></div>

                 {userRole === 'ADM' && (
                   <button 
                    onClick={() => setShowRequestsPanel(!showRequestsPanel)}
                    className={clsx(
                      'relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm shrink-0',
                      showRequestsPanel 
                        ? 'bg-primary-50 text-primary-700 border-primary-200' 
                        : 'bg-white hover:bg-navy-50 text-navy-700 border-navy-200'
                    )}
                    title="Solicitações de Alteração"
                  >
                     <Bell className='w-4 h-4' />
                     <span className='hidden md:inline'>Solicitações</span>
                     {pendingRequests.filter(r => r.status === 'pending').length > 0 && (
                       <span className='absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse'>
                         {pendingRequests.filter(r => r.status === 'pending').length}
                       </span>
                     )}
                  </button>
                 )}

                 {userRole !== 'ADM' && (
                   <>
                     <button
                       onClick={() => { setShowMyRequestsPanel(!showMyRequestsPanel); fetchMyRequests(); }}
                       className={clsx(
                         'relative flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm shrink-0',
                         showMyRequestsPanel
                           ? 'bg-primary-50 text-primary-700 border-primary-200'
                           : 'bg-white hover:bg-navy-50 text-navy-700 border-navy-200'
                       )}
                     >
                       <Bell className='w-4 h-4' />
                       <span className='hidden sm:inline'>Minhas Solicitações</span>
                       {myRequests.filter(r => r.status === 'pending').length > 0 && (
                         <span className='absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center rounded-full bg-navy-500 text-white text-[10px] font-bold ring-2 ring-white animate-pulse'>
                           {myRequests.filter(r => r.status === 'pending').length}
                         </span>
                       )}
                     </button>
                     <button
                       onClick={() => { setSolicitacaoModalTab('alterar'); setShowSolicitacaoModal(true); }}
                       className='flex items-center gap-2 btn-primary bg-primary-600 transition-colors shadow-sm shrink-0'
                     >
                       <MessageSquarePlus className='w-4 h-4' />
                       <span className='hidden sm:inline'>Solicitar Alteração</span>
                     </button>
                   </>
                 )}

                 {userRole === 'ADM' && (
                   <>
                     <button 
                      onClick={() => setShowReportModal(true)}
                      className='flex items-center gap-2 px-3 py-2 btn-secondary transition-colors shadow-sm shrink-0'
                    >
                       <ClipboardList className='w-4 h-4' /> <span className='hidden sm:inline'>Relatório</span>
                    </button>

                     <button
                      onClick={() => setShowBulkModal(true)}
                      className='flex items-center gap-2 px-3 py-2 btn-secondary transition-colors shadow-sm shrink-0'
                    >
                       <Layers className='w-4 h-4' /> <span className='hidden sm:inline'>Em massa</span>
                    </button>

                     <button
                      onClick={() => setShowModal(true)}
                      className='flex items-center gap-2 px-3 py-2 btn-primary transition-colors shadow-sm shrink-0'
                    >
                      <Plus className='w-4 h-4' /> Novo
                    </button>
                   </>
                 )}
              </div>
           </div> {/* End of Top Flex Actions */}"""

content = content.replace(old_action_bar, new_action_bar)

with open(path, 'w') as f:
    f.write(content)
print("done")
