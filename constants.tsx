
import { Folder } from './types';

export const FOLDERS: Folder[] = [
  {
    id: 'invoices',
    name: 'Счета и спецификации',
    description: 'Оплата и инвойсы',
    color: 'bg-blue-600',
    command: '/счет',
    icon: '📄'
  },
  {
    id: 'waybills',
    name: 'Накладные и УПД',
    description: 'Товарный учет',
    color: 'bg-emerald-600',
    command: '/упд',
    icon: '🚚'
  },
  {
    id: 'contracts',
    name: 'Договоры',
    description: 'Юридические док-ты',
    color: 'bg-amber-500',
    command: '/дог',
    icon: '📝'
  },
  {
    id: 'taxes',
    name: 'Налоги и отчеты',
    description: 'ФНС и фонды',
    color: 'bg-indigo-600',
    command: '/налог',
    icon: '📊'
  },
  {
    id: 'misc',
    name: 'Разное',
    description: 'Прочие документы',
    color: 'bg-slate-500',
    command: '/др',
    icon: '📁'
  }
];
