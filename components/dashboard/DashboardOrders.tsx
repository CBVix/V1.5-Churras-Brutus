
import React, { useState, useEffect, useRef } from 'react';
import { Bike, Utensils, Search, Clock, AlertTriangle, Flame, CheckCircle2, Archive, ShoppingBag, XCircle, Printer, Loader2, Volume2, VolumeX, Sparkles, Send, Check, Trash2, X } from 'lucide-react';
import { Order, OrderStatus, Tenant, OrderType } from '../../types';
import { supabase } from '../../supabaseClient';

interface DashboardOrdersProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  now: Date;
  tenant: Tenant;
}

const DashboardOrders: React.FC<DashboardOrdersProps> = ({ orders = [], setOrders, updateOrderStatus, now, tenant }) => {
  const [orderFilter, setOrderFilter] = useState<'all' | 'delivery' | 'local'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [returnStockOnDelete, setReturnStockOnDelete] = useState(true);
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') === 'true'; 
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recentOrderIds, setRecentOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.load();
    localStorage.setItem('soundEnabled', String(isAudioEnabled));
  }, [isAudioEnabled]);

  useEffect(() => {
    const channel = supabase.channel(`kds_${tenant.slug}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: `tenant_slug=eq.${tenant.slug}` 
      }, (payload) => {
        const newOrderRaw = payload.new;
        
        const mappedOrder: Order = {
          id: newOrderRaw.id,
          orderNumber: newOrderRaw.order_number,
          customerName: newOrderRaw.customer_name || 'Cliente',
          customerWhatsapp: newOrderRaw.customer_whatsapp || '',
          items: newOrderRaw.items || [],
          total: Number(newOrderRaw.total || 0),
          type: newOrderRaw.type as OrderType,
          status: newOrderRaw.status as OrderStatus,
          createdAt: new Date(newOrderRaw.created_at),
          tableNumber: newOrderRaw.table_number,
          address: newOrderRaw.address,
          observation: newOrderRaw.observation,
          userId: newOrderRaw.user_id
        };

        setOrders(prev => {
          const exists = prev.some(o => o.id === mappedOrder.id);
          if (exists) return prev;
          return [mappedOrder, ...prev];
        });

        if (isAudioEnabled && audioRef.current) {
          audioRef.current.play().catch(e => console.warn("Erro ao tocar áudio:", e));
        }

        setRecentOrderIds(prev => new Set(prev).add(mappedOrder.id));
        setTimeout(() => {
          setRecentOrderIds(prev => {
            const next = new Set(prev);
            next.delete(mappedOrder.id);
            return next;
          });
        }, 15000);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'orders',
        filter: `tenant_slug=eq.${tenant.slug}`
      }, (payload) => {
        const updated = payload.new;
        setOrders(prev => prev.map(o => o.id === updated.id ? { 
          ...o, 
          status: updated.status as OrderStatus 
        } : o));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'orders',
        filter: `tenant_slug=eq.${tenant.slug}`
      }, (payload) => {
        const deletedId = payload.old.id;
        setOrders(prev => prev.filter(o => o.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant.slug, isAudioEnabled, setOrders]);

  const handlePrintOrder = (order: Order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = order.items.map(item => {
        const sidesList = (item.selectedSides || []).length > 0 
            ? `<div style="font-size: 11px; color: #333; margin: 2px 0;">+ ${(item.selectedSides || []).map(s => s.name).join(', ')}</div>` 
            : '';
        const itemPrice = item.price + (item.selectedSides || []).reduce((acc, s) => acc + s.price, 0);
        return `
          <div style="border-bottom: 1px dashed #eee; padding: 4px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
              <span>${item.quantity}x ${item.name}</span>
              <span>R$ ${(itemPrice * item.quantity).toFixed(2)}</span>
            </div>
            ${sidesList}
            ${item.itemObservation ? `<div style="font-size: 11px; margin-top: 2px; color: #444;">* Obs: ${item.itemObservation}</div>` : ''}
          </div>
        `;
    }).join('');

    const content = `
      <html>
        <head>
          <title>Comanda #${order.orderNumber}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              padding: 10mm 5mm; 
              margin: 0;
              color: #000;
              line-height: 1.2;
            }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
            .store-name { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .order-info { font-size: 22px; font-weight: 900; margin: 5px 0; }
            .section { margin-bottom: 12px; }
            .label { font-size: 10px; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px; }
            .value { font-size: 14px; font-weight: bold; }
            .divider { border-top: 1px solid #000; margin: 10px 0; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="store-name">${tenant.name}</div>
            <div class="order-info">PEDIDO #${order.orderNumber}</div>
            <div style="font-size: 10px;">${new Date(order.createdAt).toLocaleString('pt-BR')}</div>
          </div>
          <div class="section">
            <span class="label">Cliente:</span>
            <span class="value">${order.customerName}</span>
          </div>
          <div class="section">
            <span class="label">Local / Entrega:</span>
            <span class="value">${order.type === 'delivery' ? 'DELIVERY' : `MESA ${order.tableNumber || '-'}`}</span>
          </div>
          <div class="divider"></div>
          <div class="section"><span class="label">Itens:</span>${itemsHtml}</div>
          <div class="divider"></div>
          <div class="total">TOTAL: R$ ${order.total.toFixed(2)}</div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleOutForDelivery = async (order: Order) => {
    updateOrderStatus(order.id, 'out_for_delivery');
    const message = `Olá, ${order.customerName}! Seu pedido do ${tenant.name} acabou de sair para entrega e logo chegará até você. Prepare o apetite! 🛵🔥`;
    const cleanPhone = order.customerWhatsapp.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDeleteOrder = async (order: Order) => {
    setIsDeleting(true);
    try {
      if (returnStockOnDelete) {
        for (const item of order.items) {
          const { data: product } = await supabase.from('products').select('stock').eq('id', item.id).single();
          if (product) {
            const currentStock = product.stock || 0;
            await supabase.from('products').update({ 
              stock: currentStock + item.quantity,
              availability: 'available'
            }).eq('id', item.id);
          }
        }
      }

      const { error } = await supabase.from('orders').delete().eq('id', order.id);
      if (error) throw error;
      
      setOrders(prev => prev.filter(o => o.id !== order.id));
      setSelectedOrder(null);
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error("Erro ao excluir pedido:", err);
      alert("Erro ao excluir pedido: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!o || o.status === 'finished' || o.status === 'canceled') return false;
    const matchesFilter = orderFilter === 'all' || o.type === orderFilter;
    const searchLower = orderSearch.toLowerCase();
    return matchesFilter && (
      o.customerName.toLowerCase().includes(searchLower) || 
      o.orderNumber?.toString().includes(searchLower) ||
      o.id.toString().includes(searchLower)
    );
  });

  const getOrdersByStatus = (status: OrderStatus) => filteredOrders.filter(o => o.status === status);

  const columns = [
    { id: 'pending', title: 'Novos', color: 'border-yellow-500', orders: getOrdersByStatus('pending') },
    { id: 'preparing', title: 'Em Preparo', color: 'border-blue-500', orders: getOrdersByStatus('preparing') },
    { id: 'ready_to_send', title: 'Prontos', color: 'border-green-500', orders: getOrdersByStatus('ready_to_send') },
    { id: 'out_for_delivery', title: 'Em Trânsito', color: 'border-indigo-500', orders: getOrdersByStatus('out_for_delivery') }
  ];

  return (
    <div className="flex flex-col gap-0 bg-[#09090B] pb-[50px] min-h-screen">
       <div className="flex items-center justify-between bg-[#09090B] border-b border-white/5 p-3 px-6 shadow-xl sticky top-[-20px] z-[50]">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isAudioEnabled ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-gray-500 border border-white/5'}`}
              >
                {isAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {isAudioEnabled ? 'Sons' : 'Mudo'}
              </button>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Tempo Real</span>
              </div>
          </div>
       </div>

       <div className="flex justify-between items-center gap-3 px-6 bg-[#09090B] py-4 border-b border-white/5 relative z-[10]">
          <div className="flex gap-1 bg-[#161618] p-0.5 rounded-lg border border-white/5 shadow-inner">
            <button onClick={() => setOrderFilter('all')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${orderFilter === 'all' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Todos</button>
            <button onClick={() => setOrderFilter('delivery')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${orderFilter === 'delivery' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Bike size={12}/> Delivery</button>
            <button onClick={() => setOrderFilter('local')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${orderFilter === 'local' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Utensils size={12}/> Mesa</button>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={14} />
            <input type="text" placeholder="BUSCAR..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="bg-[#161618] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-[9px] text-white focus:outline-none focus:border-primary/50 w-56 font-black tracking-widest" />
          </div>
       </div>

       <div className="w-full pt-4 overflow-x-auto hide-scrollbar bg-[#09090B]">
         <div className="flex gap-4 h-fit min-w-full items-start px-6"> 
           {columns.map(col => (
              <div key={col.id} className="w-[280px] flex-shrink-0 flex flex-col bg-[#09090B] border border-white/5 rounded-[24px] shadow-xl relative h-fit">
                <div className={`p-4 border-b border-white/5 flex justify-between items-center bg-[#111113] rounded-t-[24px] ${col.color.replace('border', 'border-b-2')}`}>
                   <h3 className="font-black text-white uppercase tracking-[0.2em] text-[9px]">{col.title}</h3>
                   <span className="bg-primary/20 text-primary text-[9px] font-black px-2 py-0.5 rounded-md border border-primary/30">{col.orders.length}</span>
                </div>
                
                <div className="p-3 space-y-3 h-fit bg-[#09090B]">
                   {col.orders.map(order => {
                      const isNew = recentOrderIds.has(order.id);
                      const waitTime = Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60000);
                      
                      return (
                        <div key={order.id} onClick={() => setSelectedOrder(order)} className={`bg-[#161618] border rounded-xl p-3 shadow-lg transition-all group relative animate-in zoom-in-95 duration-500 h-fit cursor-pointer ${isNew ? 'border-primary ring-2 ring-primary/20 shadow-primary/40 scale-[1.02] z-[20] animate-pulse' : 'border-white/5 hover:border-white/10'}`}>
                           <div className="flex justify-between items-start mb-2 pb-2 border-b border-white/5">
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-black text-white text-base tracking-tighter leading-none">#{order.orderNumber}</span>
                                    <div className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 border ${order.type === 'delivery' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                                       <span className="text-[7px] font-black uppercase tracking-widest">{order.type === 'delivery' ? 'DEL' : `M${order.tableNumber || ''}`}</span>
                                    </div>
                                 </div>
                                 <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">{order.customerName}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                 <button onClick={(e) => { e.stopPropagation(); handlePrintOrder(order); }} className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg transition-all active:scale-90 border border-primary/20 group/btn"><Printer size={12} /></button>
                                 <div className={`flex items-center gap-1 text-[8px] font-black ${waitTime > 15 ? 'text-red-500' : 'text-primary'}`}><Clock size={10} /><span>{waitTime}M</span></div>
                              </div>
                           </div>
                           
                           <div className="space-y-2 mb-3 max-h-[160px] overflow-y-auto hide-scrollbar">
                              {(order.items || []).map((item, idx) => (
                                 <div key={idx} className="flex items-start gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                                    <div className="w-5 h-5 rounded-md bg-primary text-white flex items-center justify-center font-black text-[9px] flex-shrink-0">{item.quantity}x</div>
                                    <div className="flex-1 pt-0.5">
                                       <div className="text-white text-[9px] font-bold uppercase tracking-tight leading-tight">{item.name}</div>
                                       {(item.selectedSides || []).length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                             {(item.selectedSides || []).map((s, si) => (
                                                <span key={si} className="text-[7px] font-black uppercase text-primary/80 bg-primary/10 px-1 rounded-sm">+ {s.name}</span>
                                             ))}
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              ))}
                           </div>
                           
                           <div className="pt-2 border-t border-white/5 space-y-2">
                              <div className="flex flex-col gap-1.5">
                                 {col.id === 'pending' && (
                                   <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'preparing'); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Começar</button>
                                 )}
                                 {col.id === 'preparing' && (
                                   <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'ready_to_send'); }} className="w-full bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Pronto</button>
                                 )}
                                 {col.id === 'ready_to_send' && (
                                   <div className="flex gap-1.5">
                                      {order.type === 'delivery' ? (
                                        <button onClick={(e) => { e.stopPropagation(); handleOutForDelivery(order); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95">Sair</button>
                                      ) : (
                                        <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'finished'); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Entregue</button>
                                      )}
                                   </div>
                                 )}
                                 {col.id === 'out_for_delivery' && (
                                   <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'finished'); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95">Concluído</button>
                                 )}
                              </div>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>
           ))}
         </div>
       </div>

       {/* Modal de Detalhes do Pedido */}
       {selectedOrder && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-[#161618] border border-white/10 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Topo do Modal */}
              <div className="p-6 border-b border-white/5 bg-[#09090B]/50 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Pedido #{selectedOrder.orderNumber}</h2>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${selectedOrder.type === 'delivery' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
                      {selectedOrder.type === 'delivery' ? 'Delivery' : `Mesa ${selectedOrder.tableNumber || '-'}`}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <ShoppingBag size={14} className="text-primary" /> {selectedOrder.customerName}
                  </p>
                </div>
                <button onClick={() => { setSelectedOrder(null); setShowDeleteConfirm(false); }} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Meio do Modal - Itens e Observações */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Itens do Pedido</h3>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="bg-[#09090B] border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm">{item.quantity}x</div>
                          <span className="text-white font-bold uppercase tracking-tight">{item.name}</span>
                        </div>
                        <span className="text-gray-500 font-mono text-xs">R$ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      
                      {(item.selectedSides || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-11">
                          {(item.selectedSides || []).map((s, si) => (
                            <span key={si} className="text-[9px] font-black uppercase text-primary/80 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">+ {s.name}</span>
                          ))}
                        </div>
                      )}

                      {item.itemObservation && (
                        <div className="mt-2 ml-11 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                          <AlertTriangle size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-tight italic">"{item.itemObservation}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {selectedOrder.observation && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Observação Geral</h3>
                    <div className="p-4 bg-yellow-500/5 border-2 border-dashed border-yellow-500/30 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-500">
                        <AlertTriangle size={18} />
                      </div>
                      <p className="text-sm text-yellow-500 font-bold italic leading-relaxed">
                        {selectedOrder.observation}
                      </p>
                    </div>
                  </div>
                )}

                {selectedOrder.address && selectedOrder.type === 'delivery' && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Endereço de Entrega</h3>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                      <p className="text-xs text-blue-400 font-medium leading-relaxed">{selectedOrder.address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Base do Modal - Total e Botões */}
              <div className="p-6 bg-[#09090B] border-t border-white/5 space-y-4">
                {showDeleteConfirm ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-4 animate-in zoom-in-95">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Confirmar Exclusão</p>
                        <p className="text-[10px] text-red-400 font-bold leading-relaxed">Esta ação é irreversível. O pedido será removido permanentemente do sistema.</p>
                      </div>
                    </div>
                    
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={returnStockOnDelete} 
                          onChange={(e) => setReturnStockOnDelete(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${returnStockOnDelete ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${returnStockOnDelete ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">Devolver itens ao estoque?</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        disabled={isDeleting}
                        onClick={() => handleDeleteOrder(selectedOrder)}
                        className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Exclusão'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-black uppercase tracking-[0.2em] text-[10px]">Valor Total</span>
                      <span className="text-3xl font-black text-white tracking-tighter">R$ {selectedOrder.total.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 active:scale-95"
                      >
                        <Trash2 size={16} /> Excluir Pedido
                      </button>
                      <button 
                        onClick={() => handlePrintOrder(selectedOrder)}
                        className="flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/20 active:scale-95"
                      >
                        <Printer size={16} /> Imprimir Comanda
                      </button>
                    </div>
                  </>
                )}
              </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default DashboardOrders;
