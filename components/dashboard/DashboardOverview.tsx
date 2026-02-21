
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Download, TrendingUp, TrendingDown, Star, Clock, Loader2, List, BarChart3, User, ShoppingBag, Calendar } from 'lucide-react';
import { Order } from '../../types';

interface DashboardOverviewProps {
  orders: Order[];
  financePeriod: string;
  setFinancePeriod: (period: any) => void;
  dreCalculations: any;
  chartData: any;
  handleExportCSV: () => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ 
  orders = [], financePeriod, setFinancePeriod, dreCalculations, chartData, handleExportCSV 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed'>('overview');
  const salesHourChartRef = useRef<HTMLCanvasElement>(null);
  const channelChartRef = useRef<HTMLCanvasElement>(null);

  const productSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        summary[item.name] = (summary[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  useEffect(() => {
    // @ts-ignore
    const Chart = window.Chart;
    if (!Chart || !chartData || !chartData.salesByHour || activeTab !== 'overview') return;
    let charts: any[] = [];

    if (salesHourChartRef.current) {
      const ctx = salesHourChartRef.current.getContext('2d');
      if (ctx) {
        charts.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels: chartData.hours || [],
            datasets: [{
              label: 'Vendas (R$)',
              data: chartData.salesByHour || [],
              borderColor: '#f97316',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              fill: true,
              tension: 0.4
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#1F1F23' } } } }
        }));
      }
    }

    if (channelChartRef.current) {
        const ctx = channelChartRef.current.getContext('2d');
        if (ctx) {
            charts.push(new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Delivery', 'Mesa'],
                    datasets: [{
                        data: [chartData.salesByChannel?.delivery || 0, chartData.salesByChannel?.local || 0],
                        backgroundColor: ['#f97316', '#3b82f6'],
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            }));
        }
    }

    return () => charts.forEach(c => c.destroy());
  }, [chartData]);

  if (!dreCalculations || !chartData) {
      return (
          <div className="h-full w-full flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={32} />
          </div>
      );
  }

  const handleExportCSVInternal = () => {
    const headers = ['# Pedido', 'Cliente', 'Tipo', 'Total', 'Data', 'Status'];
    const rows = orders.map(o => [
        `#${o.orderNumber || o.id.slice(0, 8)}`, 
        o.customerName, 
        o.type === 'delivery' ? 'Delivery' : 'Mesa', 
        o.total.toFixed(2), 
        new Date(o.createdAt).toLocaleDateString(), 
        o.status
    ].join(','));
    
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_vendas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
         <div className="flex bg-[#161618] p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              <BarChart3 size={14} /> Visão Geral
            </button>
            <button 
              onClick={() => setActiveTab('detailed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'detailed' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              <List size={14} /> Lista de Vendas Detalhada
            </button>
         </div>

         <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select value={financePeriod} onChange={(e: any) => setFinancePeriod(e.target.value)} className="w-full md:w-40 bg-[#161618] border border-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg pl-9 pr-3 py-2.5 outline-none appearance-none cursor-pointer hover:border-primary/50 transition-colors">
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Mês Atual</option>
              </select>
            </div>
            <button onClick={handleExportCSVInternal} className="flex items-center gap-2 bg-[#161618] border border-white/5 text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
               <Download size={14} /> Exportar
            </button>
         </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
              <p className="text-gray-400 text-xs font-bold uppercase">Faturamento</p>
              <p className="text-2xl font-bold text-white mt-1">R$ {(dreCalculations.revenue || 0).toFixed(2)}</p>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
              <p className="text-gray-400 text-xs font-bold uppercase">Pedidos</p>
              <p className="text-2xl font-bold text-white mt-1">{(orders || []).length}</p>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
               <p className="text-gray-400 text-xs font-bold uppercase">Lucro Líquido</p>
               <p className={`text-2xl font-bold mt-1 ${(dreCalculations.netProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>R$ {(dreCalculations.netProfit || 0).toFixed(2)}</p>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl">
              <p className="text-gray-400 text-xs font-bold uppercase">Ticket Médio</p>
              <p className="text-2xl font-bold text-white mt-1">R$ {((dreCalculations.revenue || 0) / ((orders || []).length || 1)).toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl h-80">
                <h3 className="text-gray-400 text-xs font-bold uppercase mb-4">Vendas por Horário</h3>
                <div className="h-64">
                    <canvas ref={salesHourChartRef} />
                </div>
            </div>
            <div className="p-6 bg-[#161618] border border-white/5 rounded-2xl h-80">
                <h3 className="text-gray-400 text-xs font-bold uppercase mb-4">Canais de Venda</h3>
                <div className="h-64">
                    <canvas ref={channelChartRef} />
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Star size={16} className="text-yellow-500" /> Top Produtos</h3>
                <div className="space-y-4">
                    {(chartData.topProducts || []).map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs text-gray-300 p-2 bg-white/5 rounded-lg">
                            <span className="font-bold">{p.name}</span>
                            <span className="text-primary font-black">{p.qty} un</span>
                        </div>
                    ))}
                </div>
             </div>
             <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Clock size={16} className="text-primary" /> Info do Período</h3>
                <p className="text-xs text-gray-400 leading-relaxed">Os dados apresentados referem-se aos pedidos finalizados dentro do período selecionado. Custos e taxas são calculados com base nas configurações da loja.</p>
             </div>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Resumo de Unidades Vendidas */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest"><ShoppingBag size={16} className="text-primary" /> Saída da Churrasqueira (Total de Unidades)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {productSummary.map(([name, qty], i) => (
                <div key={i} className="bg-[#09090B] border border-white/5 p-3 rounded-xl flex flex-col items-center justify-center text-center">
                  <span className="text-primary text-xl font-black">{qty}</span>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter mt-1 line-clamp-1">{name}</span>
                </div>
              ))}
              {productSummary.length === 0 && <p className="col-span-full text-center text-gray-600 py-4 text-xs italic">Nenhuma venda registrada no período.</p>}
            </div>
          </div>

          {/* Tabela Detalhada */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-[#09090B]/30 flex items-center gap-2">
              <List size={14} className="text-primary" />
              <h3 className="text-white font-bold uppercase text-[10px] tracking-widest">Detalhamento de Pedidos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-500 font-bold uppercase border-b border-white/5 bg-[#09090B]/20">
                  <tr>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Itens</th>
                    <th className="p-4 text-center">Total</th>
                    <th className="p-4 text-center">Data/Hora</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders.length > 0 ? orders.map((order) => (
                    <tr key={order.id} className="text-white hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                            {order.customerName.charAt(0)}
                          </div>
                          <span className="font-bold">{order.customerName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {order.items.map((item, idx) => (
                            <span key={idx} className="text-[10px] text-gray-400">
                              <span className="text-primary font-bold">{item.quantity}x</span> {item.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-emerald-500">R$ {order.total.toFixed(2)}</td>
                      <td className="p-4 text-center text-gray-500 font-mono text-[10px]">
                        {new Date(order.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          order.status === 'finished' ? 'bg-emerald-500/10 text-emerald-500' :
                          order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                          order.status === 'preparing' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-gray-500/10 text-gray-500'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-gray-600 italic">Nenhum pedido encontrado para este período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
