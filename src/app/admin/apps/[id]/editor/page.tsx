'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Plus, 
  Video, 
  FileText, 
  Trash2, 
  Edit3, 
  PlayCircle,
  Eye, 
  EyeOff,
  ChevronUp,
  ChevronDown,
  Paperclip,
  Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';

interface Module {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
}

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_provider: 'youtube' | 'vimeo' | 'wistia' | 'panda' | 'hls' | 'other';
  order_index: number;
  is_published: boolean;
}

interface AppFile {
  id: string;
  lesson_id: string;
  name: string;
  url: string;
  file_type: string;
}

export default function AppEditorPage() {
  const { id: appId } = useParams() as { id: string };
  const supabase = createClient();

  const [appName, setAppName] = useState('');
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  const [files, setFiles] = useState<AppFile[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal / Form States
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [moduleFormId, setModuleFormId] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState('');
  const [moduleDesc, setModuleDesc] = useState('');

  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonFormId, setLessonFormId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');
  const [lessonVideoUrl, setLessonVideoUrl] = useState('');
  const [lessonVideoProvider, setLessonVideoProvider] = useState<'youtube' | 'vimeo' | 'wistia' | 'panda' | 'hls' | 'other'>('youtube');
  const [lessonPublished, setLessonPublished] = useState(true);

  const [showFileModal, setShowFileModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('pdf');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load App Name
        const { data: appData } = await supabase.from('apps').select('name').eq('id', appId).single();
        if (appData) setAppName(appData.name);

        // Load Modules
        const { data: modData } = await supabase
          .from('app_modules')
          .select('*')
          .eq('app_id', appId)
          .order('order_index', { ascending: true });
        
        const loadedMods = modData || [];
        setModules(loadedMods);
        
        if (loadedMods.length > 0) {
          setSelectedModuleId(loadedMods[0].id);
        }
      } catch (err) {
        console.error('Error loading editor data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [appId, supabase]);

  // Load Lessons whenever selected module changes
  useEffect(() => {
    if (!selectedModuleId) {
      setLessons([]);
      setSelectedLesson(null);
      return;
    }

    async function loadLessons() {
      const { data: lesData } = await supabase
        .from('app_lessons')
        .select('*')
        .eq('module_id', selectedModuleId)
        .order('order_index', { ascending: true });
      
      const loadedLessons = lesData || [];
      setLessons(loadedLessons);
      
      if (loadedLessons.length > 0) {
        setSelectedLesson(loadedLessons[0]);
      } else {
        setSelectedLesson(null);
      }
    }

    loadLessons();
  }, [selectedModuleId, supabase]);

  // Load Files whenever selected lesson changes
  useEffect(() => {
    if (!selectedLesson) {
      setFiles([]);
      return;
    }

    const lessonId = selectedLesson.id;
    async function loadFiles() {
      const { data: fileData } = await supabase
        .from('app_files')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });
      setFiles(fileData || []);
    }

    loadFiles();
  }, [selectedLesson, supabase]);

  // MODULE CRUD
  const openNewModuleModal = () => {
    setModuleFormId(null);
    setModuleName('');
    setModuleDesc('');
    setShowModuleModal(true);
  };

  const openEditModuleModal = (mod: Module) => {
    setModuleFormId(mod.id);
    setModuleName(mod.name);
    setModuleDesc(mod.description || '');
    setShowModuleModal(true);
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleName) return;
    setActionLoading(true);

    try {
      if (moduleFormId) {
        // Edit module
        const { error } = await supabase
          .from('app_modules')
          .update({ name: moduleName, description: moduleDesc })
          .eq('id', moduleFormId);

        if (error) throw error;
        setModules(modules.map(m => m.id === moduleFormId ? { ...m, name: moduleName, description: moduleDesc } : m));
      } else {
        // Create module
        const nextOrder = modules.length;
        const { data, error } = await supabase
          .from('app_modules')
          .insert({
            app_id: appId,
            name: moduleName,
            description: moduleDesc || null,
            order_index: nextOrder
          })
          .select()
          .single();

        if (error) throw error;
        setModules([...modules, data]);
        setSelectedModuleId(data.id);
      }
      setShowModuleModal(false);
    } catch (err: unknown) {
      alert('Erro ao salvar módulo: ' + getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Deseja realmente excluir este módulo e todas as suas aulas?')) return;
    try {
      const { error } = await supabase.from('app_modules').delete().eq('id', moduleId);
      if (error) throw error;
      
      const newModules = modules.filter(m => m.id !== moduleId);
      setModules(newModules);
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(newModules[0]?.id || null);
      }
    } catch (err: unknown) {
      alert('Erro ao deletar módulo: ' + getErrorMessage(err));
    }
  };

  // Reorder modules
  const moveModule = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === modules.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reorderedMods = [...modules];
    
    // Swap order indexes
    const tempIndex = reorderedMods[index].order_index;
    reorderedMods[index].order_index = reorderedMods[targetIndex].order_index;
    reorderedMods[targetIndex].order_index = tempIndex;

    // Swap items in state array
    const tempItem = reorderedMods[index];
    reorderedMods[index] = reorderedMods[targetIndex];
    reorderedMods[targetIndex] = tempItem;

    setModules(reorderedMods);

    // Save to database
    await Promise.all([
      supabase.from('app_modules').update({ order_index: reorderedMods[index].order_index }).eq('id', reorderedMods[index].id),
      supabase.from('app_modules').update({ order_index: reorderedMods[targetIndex].order_index }).eq('id', reorderedMods[targetIndex].id),
    ]);
  };

  // LESSON CRUD
  const openNewLessonModal = () => {
    setLessonFormId(null);
    setLessonTitle('');
    setLessonDesc('');
    setLessonVideoUrl('');
    setLessonVideoProvider('youtube');
    setLessonPublished(true);
    setShowLessonModal(true);
  };

  const openEditLessonModal = (les: Lesson) => {
    setLessonFormId(les.id);
    setLessonTitle(les.title);
    setLessonDesc(les.description || '');
    setLessonVideoUrl(les.video_url || '');
    setLessonVideoProvider(les.video_provider);
    setLessonPublished(les.is_published);
    setShowLessonModal(true);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle || !selectedModuleId) return;
    setActionLoading(true);

    try {
      if (lessonFormId) {
        // Edit lesson
        const { error } = await supabase
          .from('app_lessons')
          .update({
            title: lessonTitle,
            description: lessonDesc || null,
            video_url: lessonVideoUrl || null,
            video_provider: lessonVideoProvider,
            is_published: lessonPublished,
          })
          .eq('id', lessonFormId);

        if (error) throw error;
        
        const updatedLessons = lessons.map(l => 
          l.id === lessonFormId 
            ? { ...l, title: lessonTitle, description: lessonDesc, video_url: lessonVideoUrl, video_provider: lessonVideoProvider, is_published: lessonPublished } 
            : l
        );
        setLessons(updatedLessons);
        setSelectedLesson(updatedLessons.find(l => l.id === lessonFormId) || null);
      } else {
        // Create lesson
        const nextOrder = lessons.length;
        const { data, error } = await supabase
          .from('app_lessons')
          .insert({
            module_id: selectedModuleId,
            title: lessonTitle,
            description: lessonDesc || null,
            video_url: lessonVideoUrl || null,
            video_provider: lessonVideoProvider,
            order_index: nextOrder,
            is_published: lessonPublished,
          })
          .select()
          .single();

        if (error) throw error;
        setLessons([...lessons, data]);
        setSelectedLesson(data);
      }
      setShowLessonModal(false);
    } catch (err: unknown) {
      alert('Erro ao salvar aula: ' + getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Deseja realmente excluir esta aula?')) return;
    try {
      const { error } = await supabase.from('app_lessons').delete().eq('id', lessonId);
      if (error) throw error;
      
      const newLessons = lessons.filter(l => l.id !== lessonId);
      setLessons(newLessons);
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(newLessons[0] || null);
      }
    } catch (err: unknown) {
      alert('Erro ao deletar aula: ' + getErrorMessage(err));
    }
  };

  const moveLesson = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === lessons.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...lessons];
    
    // Swap indexes
    const tempIndex = reordered[index].order_index;
    reordered[index].order_index = reordered[targetIndex].order_index;
    reordered[targetIndex].order_index = tempIndex;

    // Swap items
    const tempItem = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = tempItem;

    setLessons(reordered);

    await Promise.all([
      supabase.from('app_lessons').update({ order_index: reordered[index].order_index }).eq('id', reordered[index].id),
      supabase.from('app_lessons').update({ order_index: reordered[targetIndex].order_index }).eq('id', reordered[targetIndex].id),
    ]);
  };

  // FILE ATTACHMENTS
  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || !fileUrl || !selectedLesson) return;
    setActionLoading(true);

    try {
      const { data, error } = await supabase
        .from('app_files')
        .insert({
          lesson_id: selectedLesson.id,
          name: fileName.trim(),
          url: fileUrl.trim(),
          file_type: fileType,
        })
        .select()
        .single();

      if (error) throw error;
      setFiles([...files, data]);
      setFileName('');
      setFileUrl('');
      setShowFileModal(false);
    } catch (err: unknown) {
      alert('Erro ao anexar arquivo: ' + getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase.from('app_files').delete().eq('id', fileId);
      if (error) throw error;
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err: unknown) {
      alert('Erro ao excluir arquivo: ' + getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-text-gray text-sm">Carregando editor visual...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      
      {/* Top navbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/admin/apps"
            className="flex items-center justify-center p-2 text-text-gray hover:text-text-white bg-card-bg/80 border border-border-color/60 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-text-white">{appName} — Grade de Conteúdo</h2>
            <p className="text-xs text-text-gray mt-0.5">Monte seus módulos, aulas, vídeos e materiais de apoio.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: MODULES */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-4 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color/30 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray flex items-center gap-1.5">
                Módulos
              </h3>
              <button
                onClick={openNewModuleModal}
                className="flex items-center gap-1 bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20 text-light-blue px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              >
                <Plus className="h-3 w-3" />
                Criar Módulo
              </button>
            </div>

            {modules.length === 0 ? (
              <div className="text-center py-10 text-text-gray text-xs">
                Nenhum módulo criado. Crie um módulo para começar a adicionar aulas.
              </div>
            ) : (
              <div className="space-y-2">
                {modules.map((mod, index) => {
                  const isSelected = selectedModuleId === mod.id;
                  return (
                    <div 
                      key={mod.id} 
                      className={`group border rounded-xl flex items-center justify-between px-3 py-2.5 transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-accent-blue/10 border-accent-blue text-text-white' 
                          : 'bg-card-bg/40 border-border-color/50 text-text-gray hover:text-text-white hover:border-border-color'
                      }`}
                      onClick={() => setSelectedModuleId(mod.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-text-gray/50 font-bold">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{mod.name}</p>
                          {mod.description && <p className="text-[10px] text-text-gray truncate">{mod.description}</p>}
                        </div>
                      </div>

                      {/* Module control buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveModule(index, 'up'); }}
                          disabled={index === 0}
                          className="p-1 text-text-gray hover:text-text-white disabled:opacity-30"
                          title="Subir Módulo"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveModule(index, 'down'); }}
                          disabled={index === modules.length - 1}
                          className="p-1 text-text-gray hover:text-text-white disabled:opacity-30"
                          title="Descer Módulo"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModuleModal(mod); }}
                          className="p-1 text-text-gray hover:text-light-blue"
                          title="Editar Nome/Descrição"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteModule(mod.id); }}
                          className="p-1 text-text-gray hover:text-red-400"
                          title="Excluir Módulo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN: LESSONS */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-4 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color/30 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray">
                Aulas do Módulo
              </h3>
              {selectedModuleId && (
                <button
                  onClick={openNewLessonModal}
                  className="flex items-center gap-1 bg-accent-blue/10 border border-accent-blue/20 hover:bg-accent-blue/20 text-light-blue px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                >
                  <Plus className="h-3 w-3" />
                  Nova Aula
                </button>
              )}
            </div>

            {!selectedModuleId ? (
              <div className="text-center py-10 text-text-gray text-xs">
                Selecione ou crie um módulo para gerenciar aulas.
              </div>
            ) : lessons.length === 0 ? (
              <div className="text-center py-10 text-text-gray text-xs">
                Nenhuma aula cadastrada neste módulo.
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map((les, index) => {
                  const isSelected = selectedLesson?.id === les.id;
                  return (
                    <div 
                      key={les.id}
                      className={`group border rounded-xl flex items-center justify-between px-3 py-2.5 transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-accent-blue/10 border-accent-blue text-text-white' 
                          : 'bg-card-bg/40 border-border-color/50 text-text-gray hover:text-text-white hover:border-border-color'
                      }`}
                      onClick={() => setSelectedLesson(les)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg border ${
                          les.is_published 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        }`}>
                          <PlayCircle className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate">{les.title}</p>
                          <p className="text-[9px] text-text-gray capitalize font-mono">{les.video_provider} • Order {index + 1}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveLesson(index, 'up'); }}
                          disabled={index === 0}
                          className="p-1 text-text-gray hover:text-white disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveLesson(index, 'down'); }}
                          disabled={index === lessons.length - 1}
                          className="p-1 text-text-gray hover:text-white disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditLessonModal(les); }}
                          className="p-1 text-text-gray hover:text-light-blue"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteLesson(les.id); }}
                          className="p-1 text-text-gray hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LESSON DETAILS & ATTACHMENTS */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-4 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-gray border-b border-border-color/30 pb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-light-blue" />
              Conteúdo da Aula & Arquivos
            </h3>

            {!selectedLesson ? (
              <div className="text-center py-12 text-text-gray text-xs">
                Selecione uma aula para visualizar materiais e anexos.
              </div>
            ) : (
              <div className="space-y-5">
                
                {/* Lesson info box */}
                <div className="bg-primary-bg/50 border border-border-color/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-text-white truncate">{selectedLesson.title}</h4>
                    <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-semibold ${
                      selectedLesson.is_published 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {selectedLesson.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {selectedLesson.is_published ? 'Visível' : 'Oculta'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-gray">{selectedLesson.description || 'Sem descrição cadastrada.'}</p>
                  
                  {selectedLesson.video_url && (
                    <div className="bg-card-bg/60 border border-border-color/45 rounded-lg p-2 flex items-center gap-2 text-[10px] text-light-blue truncate">
                      <Video className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-mono truncate">{selectedLesson.video_url}</span>
                    </div>
                  )}
                </div>

                {/* Attachments Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-t border-border-color/20 pt-4">
                    <span className="text-[10px] font-bold text-text-gray uppercase tracking-wider">Arquivos & Materiais ({files.length})</span>
                    <button
                      onClick={() => setShowFileModal(true)}
                      className="text-[10px] font-bold text-light-blue hover:text-accent-blue flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      Anexar PDF/Link
                    </button>
                  </div>

                  {files.length === 0 ? (
                    <div className="text-center py-6 text-text-gray text-[11px] bg-primary-bg/25 border border-dashed border-border-color/30 rounded-xl">
                      Nenhum material de apoio anexado a esta aula.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between bg-primary-bg/40 border border-border-color/30 rounded-lg p-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-light-blue shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-text-white truncate">{file.name}</p>
                              <span className="text-[9px] text-text-gray font-mono truncate block">{file.url}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="p-1 text-text-gray hover:text-red-400 shrink-0"
                            title="Remover anexo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

      </div>

      {/* 1. MODULE MODAL */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-primary-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleModuleSubmit} className="bg-secondary-bg border border-border-color max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-text-white">
              {moduleFormId ? 'Editar Módulo' : 'Novo Módulo'}
            </h3>
            
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Nome do Módulo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Módulo 01 - Fundamentos"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Descrição Curta</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Primeiros passos no conteúdo..."
                  value={moduleDesc}
                  onChange={(e) => setModuleDesc(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border-color/30">
              <button
                type="button"
                onClick={() => setShowModuleModal(false)}
                className="bg-card-bg hover:bg-border-color px-4 py-2 rounded-xl text-xs font-semibold text-text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-accent-blue hover:bg-light-blue px-4 py-2 rounded-xl text-xs font-semibold text-text-white flex items-center gap-1"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Salvar Módulo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. LESSON MODAL */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-primary-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleLessonSubmit} className="bg-secondary-bg border border-border-color max-w-lg w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-text-white">
              {lessonFormId ? 'Editar Aula' : 'Nova Aula'}
            </h3>
            
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-text-gray mb-1.5">Título da Aula *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Aula 01 - Primeiros Passos"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Descrição da Aula</label>
                <textarea
                  rows={2}
                  placeholder="Sobre o que é esta aula..."
                  value={lessonDesc}
                  onChange={(e) => setLessonDesc(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-text-gray mb-1.5">Provedor de Vídeo</label>
                  <select
                    value={lessonVideoProvider}
                    onChange={(e) => setLessonVideoProvider(e.target.value as Lesson['video_provider'])}
                    className="w-full bg-primary-bg border border-border-color text-text-white px-3 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="wistia">Wistia</option>
                    <option value="panda">Panda Video</option>
                    <option value="hls">M3U8 / HLS Stream</option>
                    <option value="other">Outro Link Direto</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-text-gray mb-1.5">URL do Vídeo</label>
                  <input
                    type="text"
                    placeholder="Cole a URL ou ID do vídeo"
                    value={lessonVideoUrl}
                    onChange={(e) => setLessonVideoUrl(e.target.value)}
                    className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-text-gray cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lessonPublished}
                    onChange={(e) => setLessonPublished(e.target.checked)}
                    className="h-4 w-4 bg-primary-bg border border-border-color rounded focus:ring-accent-blue"
                  />
                  <span>Publicar esta aula (Visível aos alunos)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border-color/30">
              <button
                type="button"
                onClick={() => setShowLessonModal(false)}
                className="bg-card-bg hover:bg-border-color px-4 py-2 rounded-xl text-xs font-semibold text-text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-accent-blue hover:bg-light-blue px-4 py-2 rounded-xl text-xs font-semibold text-text-white flex items-center gap-1"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Salvar Aula
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. FILE MODAL */}
      {showFileModal && (
        <div className="fixed inset-0 bg-primary-bg/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddFile} className="bg-secondary-bg border border-border-color max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-text-white">Anexar Material de Apoio</h3>
            
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Nome do Arquivo / PDF</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PDF de Exercícios da Aula 1"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-gray mb-1.5">URL de Download / Destino</label>
                <input
                  type="url"
                  required
                  placeholder="https://exemplo.com/material.pdf"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-accent-blue"
                />
              </div>

              <div>
                <label className="block font-semibold text-text-gray mb-1.5">Tipo de Arquivo</label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full bg-primary-bg border border-border-color text-text-white px-3 py-2.5 rounded-xl focus:outline-none"
                >
                  <option value="pdf">PDF</option>
                  <option value="link">Link Externo</option>
                  <option value="zip">Arquivo Compactado (ZIP)</option>
                  <option value="image">Imagem</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border-color/30">
              <button
                type="button"
                onClick={() => setShowFileModal(false)}
                className="bg-card-bg hover:bg-border-color px-4 py-2 rounded-xl text-xs font-semibold text-text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="bg-accent-blue hover:bg-light-blue px-4 py-2 rounded-xl text-xs font-semibold text-text-white flex items-center gap-1"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Anexar
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
