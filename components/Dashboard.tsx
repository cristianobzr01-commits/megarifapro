
import React from 'react';

interface DashboardProps {
  total: number;
  sold: number;
  reserved: number;
  revenue: number;
}

const Dashboard: React.FC<DashboardProps> = ({ total, sold, reserved, revenue }) => {
  const soldPercentage = ((sold / total) * 100).toFixed(2);
  const reservedPercentage = ((reserved / total) * 100).toFixed(2);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-slate-500 text-sm font-medium mb-1">Números Vendidos</h3>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-slate-900">{sold.toLocaleString()}</span>
          <span className="text-slate-400 text-sm mb-1">/ {total.toLocaleString()}</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-500" 
            style={{ width: `${soldPercentage}%` }}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-slate-500 text-sm font-medium mb-1">Reservados</h3>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-amber-500">{reserved.toLocaleString()}</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
          <div 
            className="bg-amber-400 h-full transition-all duration-500" 
            style={{ width: `${reservedPercentage}%` }}
          />
        </div>
        <p className="text-slate-400 text-xs mt-2">Aguardando pagamento</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-slate-500 text-sm font-medium mb-1">Progresso Total</h3>
        <div className="text-3xl font-bold text-slate-900">{soldPercentage}%</div>
        <p className="text-slate-400 text-sm mt-1">Conclusão da meta</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-slate-500 text-sm font-medium mb-1">Arrecadação Bruta</h3>
        <div className="text-3xl font-bold text-emerald-600">R$ {revenue.toLocaleString()}</div>
        <p className="text-slate-400 text-sm mt-1">Estimativa de vendas</p>
      </div>
    </div>
  );
};

export default Dashboard;
