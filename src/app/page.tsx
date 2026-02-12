'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Users,
  Scissors,
  Ruler,
  Plus,
  Trash2,
  User,
  Package,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Copy,
  ExternalLink
} from 'lucide-react';

// Типы данных
interface Client {
  id: string;
  name: string;
  createdAt: string;
  _count?: { products: number };
}

interface Product {
  id: string;
  name: string;
  clientId: string;
  client?: Client;
  createdAt: string;
  _count?: { measurements: number };
}

interface Measurement {
  id: string;
  version: number;
  date: string;
  data: Record<string, string>;
  productId: string;
  product?: Product & { client?: Client };
}

export default function Home() {
  // Состояния
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Диалоги
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
  
  // Формы
  const [newClientName, setNewClientName] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [measurementData, setMeasurementData] = useState('');
  
  // Выбранные элементы
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Загрузка данных
  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data);
    } catch (error) {
      toast.error('Ошибка загрузки клиентов');
    }
  };

  const fetchProducts = async (clientId?: string) => {
    try {
      const url = clientId ? `/api/products?clientId=${clientId}` : '/api/products';
      const res = await fetch(url);
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      toast.error('Ошибка загрузки изделий');
    }
  };

  const fetchMeasurements = async (productId?: string) => {
    try {
      const url = productId ? `/api/measurements?productId=${productId}` : '/api/measurements';
      const res = await fetch(url);
      const data = await res.json();
      setMeasurements(data);
    } catch (error) {
      toast.error('Ошибка загрузки замеров');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchClients(), fetchProducts(), fetchMeasurements()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Добавление клиента
  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      toast.error('Введите имя клиента');
      return;
    }
    
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim() })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      
      toast.success(`Клиент "${newClientName}" добавлен`);
      setNewClientName('');
      setClientDialogOpen(false);
      fetchClients();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Удаление клиента
  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`Удалить клиента "${client.name}" и все его изделия?`)) return;
    
    try {
      await fetch(`/api/clients?id=${client.id}`, { method: 'DELETE' });
      toast.success(`Клиент "${client.name}" удален`);
      fetchClients();
      fetchProducts();
      fetchMeasurements();
      if (selectedClient?.id === client.id) {
        setSelectedClient(null);
      }
    } catch (error: any) {
      toast.error('Ошибка удаления');
    }
  };

  // Добавление изделия
  const handleAddProduct = async () => {
    if (!newProductName.trim()) {
      toast.error('Введите название изделия');
      return;
    }
    if (!selectedClientId) {
      toast.error('Выберите клиента');
      return;
    }
    
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProductName.trim(), clientId: selectedClientId })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      
      toast.success(`Изделие "${newProductName}" создано`);
      setNewProductName('');
      setSelectedClientId('');
      setProductDialogOpen(false);
      fetchProducts();
      fetchClients();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Удаление изделия
  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Удалить изделие "${product.name}"?`)) return;
    
    try {
      await fetch(`/api/products?id=${product.id}`, { method: 'DELETE' });
      toast.success(`Изделие "${product.name}" удалено`);
      fetchProducts();
      fetchMeasurements();
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(null);
      }
    } catch (error: any) {
      toast.error('Ошибка удаления');
    }
  };

  // Добавление замера
  const handleAddMeasurement = async () => {
    if (!selectedProductId) {
      toast.error('Выберите изделие');
      return;
    }
    
    // Парсим данные замера
    const lines = measurementData.split(/[,\n]/).map(l => l.trim()).filter(l => l);
    const data: Record<string, string> = {};
    
    for (const line of lines) {
      const match = line.match(/(.+?)\s+(\d+(?:[.,]\d+)?)/);
      if (match) {
        data[match[1].trim().toLowerCase()] = match[2].replace(',', '.');
      }
    }
    
    if (Object.keys(data).length === 0) {
      toast.error('Не удалось распознать замеры. Используйте формат "талия 90, бедра 95"');
      return;
    }
    
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProductId, data })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }
      
      toast.success('Замер сохранен');
      setMeasurementData('');
      setSelectedProductId('');
      setMeasurementDialogOpen(false);
      fetchMeasurements();
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Удаление замера
  const handleDeleteMeasurement = async (measurement: Measurement) => {
    if (!confirm(`Удалить замер #${measurement.version}?`)) return;
    
    try {
      await fetch(`/api/measurements?id=${measurement.id}`, { method: 'DELETE' });
      toast.success('Замер удален');
      fetchMeasurements();
    } catch (error: any) {
      toast.error('Ошибка удаления');
    }
  };

  // Копирование webhook URL
  const copyWebhookUrl = () => {
    const url = `${window.location.origin}/api/alice`;
    navigator.clipboard.writeText(url);
    toast.success('URL скопирован');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Записная книжка швеи</h1>
                <p className="text-sm text-gray-500">Навык для Яндекс Алисы</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="mr-2 h-4 w-4" />
                Webhook URL
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="clients" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              Клиенты
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" />
              Изделия
            </TabsTrigger>
            <TabsTrigger value="measurements" className="gap-2">
              <Ruler className="h-4 w-4" />
              Замеры
            </TabsTrigger>
          </TabsList>

          {/* Клиенты */}
          <TabsContent value="clients">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Клиенты</CardTitle>
                      <CardDescription>Список всех клиентов</CardDescription>
                    </div>
                    <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Добавить
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Новый клиент</DialogTitle>
                          <DialogDescription>
                            Введите имя клиента для добавления в записную книжку
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="clientName">Имя клиента</Label>
                            <Input
                              id="clientName"
                              placeholder="Например: Вася"
                              value={newClientName}
                              onChange={e => setNewClientName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddClient()}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setClientDialogOpen(false)}>
                            Отмена
                          </Button>
                          <Button onClick={handleAddClient}>Добавить</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-8 text-gray-500">Загрузка...</div>
                    ) : clients.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>Пока нет клиентов</p>
                        <p className="text-sm">Добавьте первого клиента</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {clients.map(client => (
                          <div
                            key={client.id}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer ${
                              selectedClient?.id === client.id
                                ? 'border-rose-300 bg-rose-50'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              setSelectedClient(client);
                              fetchProducts(client.id);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                                <User className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{client.name}</p>
                                <p className="text-sm text-gray-500">
                                  {client._count?.products || 0} изделий
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-400 hover:text-red-500"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteClient(client);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Подсказки */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-rose-500" />
                      Голосовые команды
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"запомни нового клиента Вася"</code>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"перечисли клиентов"</code>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HelpCircle className="h-4 w-4 text-amber-500" />
                      Подключение к Алисе
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 space-y-2">
                    <p>1. Создайте навык в Яндекс Диалогах</p>
                    <p>2. Укажите Webhook URL</p>
                    <p>3. Активируйте навык</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Изделия */}
          <TabsContent value="products">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Изделия</CardTitle>
                      <CardDescription>
                        {selectedClient
                          ? `Изделия клиента "${selectedClient.name}"`
                          : 'Все изделия'}
                      </CardDescription>
                    </div>
                    <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Добавить
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Новое изделие</DialogTitle>
                          <DialogDescription>
                            Создайте новое изделие для клиента
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Клиент</Label>
                            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите клиента" />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map(client => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="productName">Название изделия</Label>
                            <Input
                              id="productName"
                              placeholder="Например: куртка"
                              value={newProductName}
                              onChange={e => setNewProductName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddProduct()}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
                            Отмена
                          </Button>
                          <Button onClick={handleAddProduct}>Создать</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-8 text-gray-500">Загрузка...</div>
                    ) : products.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>Пока нет изделий</p>
                        <p className="text-sm">Создайте первое изделие</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {products.map(product => (
                          <div
                            key={product.id}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-colors cursor-pointer ${
                              selectedProduct?.id === product.id
                                ? 'border-rose-300 bg-rose-50'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => {
                              setSelectedProduct(product);
                              fetchMeasurements(product.id);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                                <Package className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-gray-500">
                                  {product.client?.name} • {product._count?.measurements || 0} замеров
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-gray-400 hover:text-red-500"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteProduct(product);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Подсказки */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-rose-500" />
                      Голосовые команды
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"создай для Васи изделие куртка"</code>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"перечисли изделия для Васи"</code>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Замеры */}
          <TabsContent value="measurements">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Замеры</CardTitle>
                      <CardDescription>
                        {selectedProduct
                          ? `Замеры изделия "${selectedProduct.name}"`
                          : 'Все замеры'}
                      </CardDescription>
                    </div>
                    <Dialog open={measurementDialogOpen} onOpenChange={setMeasurementDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Добавить
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Новый замер</DialogTitle>
                          <DialogDescription>
                            Введите параметры замера
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Изделие</Label>
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите изделие" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map(product => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} ({product.client?.name})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="measurementData">Замеры</Label>
                            <Textarea
                              id="measurementData"
                              placeholder="талия 90, бедра 95, длина 70"
                              value={measurementData}
                              onChange={e => setMeasurementData(e.target.value)}
                              rows={4}
                            />
                            <p className="text-xs text-gray-500">
                              Формат: "параметр значение", разделитель - запятая или новая строка
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setMeasurementDialogOpen(false)}>
                            Отмена
                          </Button>
                          <Button onClick={handleAddMeasurement}>Сохранить</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="text-center py-8 text-gray-500">Загрузка...</div>
                    ) : measurements.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Ruler className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p>Пока нет замеров</p>
                        <p className="text-sm">Добавьте первый замер</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {measurements.map(measurement => (
                          <div
                            key={measurement.id}
                            className="rounded-lg border p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                  Замер #{measurement.version}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {new Date(measurement.date).toLocaleDateString('ru-RU')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">
                                  {measurement.product?.name} ({measurement.product?.client?.name})
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                                  onClick={() => handleDeleteMeasurement(measurement)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(measurement.data).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="bg-white">
                                  {key}: <span className="font-medium ml-1">{value}</span>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Подсказки */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-rose-500" />
                      Голосовые команды
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"запоминай замеры для куртка"</code>
                      <p className="text-xs text-gray-500 mt-1">Затем назовите параметры</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"конец записи"</code>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <code className="text-rose-600">"перечисли замеры для куртка"</code>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 mt-auto border-t bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <p>
              Всего: {clients.length} клиентов, {products.length} изделий, {measurements.length} замеров
            </p>
            <p>
              Webhook: <code className="text-rose-600">/api/alice</code>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
