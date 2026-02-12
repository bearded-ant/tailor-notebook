import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Типы для Яндекс Диалогов
interface AliceRequest {
  meta: {
    locale: string;
    timezone: string;
    client_id: string;
  };
  request: {
    command: string;
    original_utterance: string;
    type: string;
    markup?: {
      dangerous_context: boolean;
    };
    nlu: {
      tokens: string[];
      entities: any[];
      intents: any;
    };
  };
  session: {
    message_id: number;
    session_id: string;
    skill_id: string;
    user_id: string;
    user?: {
      user_id: string;
      access_token?: string;
    };
    application: {
      application_id: string;
    };
    new: boolean;
  };
  version: string;
}

interface AliceResponse {
  response: {
    text: string;
    tts?: string;
    end_session: boolean;
    buttons?: Array<{
      title: string;
      payload?: any;
      url?: string;
      hide?: boolean;
    }>;
  };
  session: {
    message_id: number;
    session_id: string;
    skill_id: string;
    user_id: string;
  };
  version: string;
}

// Состояние сессии для многоходовых диалогов
const sessionStates = new Map<string, {
  state: 'idle' | 'waiting_measurements';
  clientName?: string;
  productName?: string;
  measurementsText?: string;
}>();

// Максимальная длина входной строки для защиты от ReDoS
const MAX_INPUT_LENGTH = 500;

// Парсинг команды
function parseCommand(text: string): { action: string; params: string[] } | null {
  // Защита от слишком длинных строк
  if (text.length > MAX_INPUT_LENGTH) {
    return { action: 'help', params: [] };
  }
  
  const normalizedText = text.toLowerCase().trim();
  
  // Запомни нового клиента [имя]
  const newClientMatch = normalizedText.match(/запомни\s+(?:нового\s+)?клиента\s+([^]{1,100})$/i);
  if (newClientMatch) {
    return { action: 'add_client', params: [newClientMatch[1].trim()] };
  }
  
  // Создай для [клиент] изделие [название] - безопасный парсинг
  if (normalizedText.startsWith('создай для ') && normalizedText.includes(' изделие ')) {
    const parts = normalizedText.split(/\s+изделие\s+/);
    if (parts.length === 2) {
      const clientPart = parts[0].replace(/^создай\s+для\s+/, '').trim();
      const productPart = parts[1].trim();
      if (clientPart && productPart) {
        return { action: 'add_product', params: [clientPart, productPart] };
      }
    }
  }
  
  // Запоминай замеры для [изделие]
  const startMeasurementMatch = normalizedText.match(/запоминай\s+замеры\s+для\s+([^]{1,100})$/i);
  if (startMeasurementMatch) {
    return { action: 'start_measurement', params: [startMeasurementMatch[1].trim()] };
  }
  
  // Конец записи
  if (normalizedText.includes('конец записи')) {
    return { action: 'end_measurement', params: [] };
  }
  
  // Перечисли клиентов
  if (/^перечисли\s+клиентов$/i.test(normalizedText) || /^список\s+клиентов$/i.test(normalizedText)) {
    return { action: 'list_clients', params: [] };
  }
  
  // Перечисли изделия для [клиент]
  const listProductsMatch = normalizedText.match(/^перечисли\s+изделия\s+(?:для\s+)?([^]{1,100})$/i);
  if (listProductsMatch) {
    return { action: 'list_products', params: [listProductsMatch[1].trim()] };
  }
  
  // Перечисли замеры для [изделие]
  const listMeasurementsMatch = normalizedText.match(/^перечисли\s+замеры\s+(?:для\s+)?([^]{1,100})$/i);
  if (listMeasurementsMatch) {
    return { action: 'list_measurements', params: [listMeasurementsMatch[1].trim()] };
  }
  
  // Помощь
  if (/помощь|что ты умеешь|команды/i.test(normalizedText)) {
    return { action: 'help', params: [] };
  }
  
  return null;
}

// Обработка добавления клиента
async function handleAddClient(name: string): Promise<string> {
  try {
    await db.client.create({
      data: { name }
    });
    return `Клиент "${name}" успешно записан!`;
  } catch (error: any) {
    if (error.code === 'P2002') {
      return `Клиент "${name}" уже существует в записной книжке.`;
    }
    return `Ошибка при сохранении клиента: ${error.message}`;
  }
}

// Обработка добавления изделия
async function handleAddProduct(clientName: string, productName: string): Promise<string> {
  try {
    const client = await db.client.findFirst({
      where: { name: { equals: clientName, mode: 'insensitive' } }
    });
    
    if (!client) {
      return `Клиент "${clientName}" не найден. Сначала добавьте клиента командой "запомни нового клиента ${clientName}".`;
    }
    
    await db.product.create({
      data: {
        name: productName,
        clientId: client.id
      }
    });
    
    return `Изделие "${productName}" для клиента "${clientName}" успешно создано!`;
  } catch (error: any) {
    if (error.code === 'P2002') {
      return `Изделие "${productName}" уже существует для клиента "${clientName}".`;
    }
    return `Ошибка при создании изделия: ${error.message}`;
  }
}

// Начало записи замеров
async function handleStartMeasurement(sessionId: string, productName: string): Promise<string> {
  // Ищем изделие
  const product = await db.product.findFirst({
    where: { name: { equals: productName, mode: 'insensitive' } },
    include: { client: true }
  });
  
  if (!product) {
    return `Изделие "${productName}" не найдено. Сначала создайте его командой "создай для [клиент] изделие ${productName}".`;
  }
  
  sessionStates.set(sessionId, {
    state: 'waiting_measurements',
    productName: product.name,
    clientName: product.client.name,
    measurementsText: ''
  });
  
  return `Начинаю запись замеров для изделия "${product.name}" клиента "${product.client.name}". Называйте замеры в формате "талия 90, бедра 95". Когда закончите, скажите "конец записи".`;
}

// Сохранение замеров
async function handleSaveMeasurements(sessionId: string, measurementsText: string): Promise<string> {
  const state = sessionStates.get(sessionId);
  if (!state || state.state !== 'waiting_measurements' || !state.productName) {
    return 'Сначала начните запись замеров командой "запоминай замеры для [изделие]".';
  }
  
  // Добавляем текст к накопленным замерам
  const fullText = state.measurementsText ? `${state.measurementsText}, ${measurementsText}` : measurementsText;
  state.measurementsText = fullText;
  
  return `Записала: "${measurementsText}". Продолжайте называть замеры или скажите "конец записи" для завершения.`;
}

// Завершение записи замеров
async function handleEndMeasurement(sessionId: string): Promise<string> {
  const state = sessionStates.get(sessionId);
  if (!state || state.state !== 'waiting_measurements' || !state.productName) {
    return 'Сначала начните запись замеров командой "запоминай замеры для [изделие]".';
  }
  
  const measurementsText = state.measurementsText || '';
  
  if (!measurementsText) {
    sessionStates.delete(sessionId);
    return 'Нет записанных замеров. Начните заново командой "запоминай замеры для [изделие]".';
  }
  
  // Парсим замеры из текста
  const lines = measurementsText.split(/[,\n]/).map(l => l.trim()).filter(l => l);
  const measurements: Record<string, string> = {};
  
  for (const line of lines) {
    // Безопасное регулярное выражение с ограничением длины параметра
    const match = line.match(/^([^\d]{1,50})\s+(\d+(?:[.,]\d+)?)$/);
    if (match) {
      measurements[match[1].trim().toLowerCase()] = match[2].replace(',', '.');
    }
  }
  
  if (Object.keys(measurements).length === 0) {
    sessionStates.delete(sessionId);
    return 'Не удалось распознать замеры. Попробуйте формат "талия 90, бедра 95".';
  }
  
  try {
    // Ищем изделие
    const product = await db.product.findFirst({
      where: { name: { equals: state.productName, mode: 'insensitive' } },
      include: { measurements: true }
    });
    
    if (!product) {
      sessionStates.delete(sessionId);
      return `Изделие "${state.productName}" не найдено.`;
    }
    
    const nextVersion = product.measurements.length + 1;
    
    await db.measurement.create({
      data: {
        version: nextVersion,
        data: JSON.stringify(measurements),
        productId: product.id
      }
    });
    
    sessionStates.delete(sessionId);
    
    const measurementsList = Object.entries(measurements)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    
    return `Замер #${nextVersion} для изделия "${product.name}" успешно сохранён! Записанные параметры: ${measurementsList}.`;
  } catch (error: any) {
    sessionStates.delete(sessionId);
    return `Ошибка при сохранении замеров: ${error.message}`;
  }
}

// Список клиентов
async function handleListClients(): Promise<string> {
  const clients = await db.client.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  if (clients.length === 0) {
    return 'Записная книжка пуста. Добавьте первого клиента командой "запомни нового клиента [имя]".';
  }
  
  const names = clients.map(c => c.name).join(', ');
  const countText = clients.length === 1 ? 'клиент' : clients.length < 5 ? 'клиента' : 'клиентов';
  return `Ваши клиенты: ${names}. Всего ${clients.length} ${countText}.`;
}

// Список изделий клиента
async function handleListProducts(clientName: string): Promise<string> {
  const client = await db.client.findFirst({
    where: { name: { equals: clientName, mode: 'insensitive' } },
    include: {
      products: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  if (!client) {
    return `Клиент "${clientName}" не найден.`;
  }
  
  if (client.products.length === 0) {
    return `У клиента "${client.name}" пока нет изделий. Создайте первое командой "создай для ${client.name} изделие [название]".`;
  }
  
  const productNames = client.products.map(p => p.name).join(', ');
  const countText = client.products.length === 1 ? 'изделие' : client.products.length < 5 ? 'изделия' : 'изделий';
  return `Изделия клиента "${client.name}": ${productNames}. Всего ${client.products.length} ${countText}.`;
}

// Список замеров изделия
async function handleListMeasurements(productName: string): Promise<string> {
  const product = await db.product.findFirst({
    where: { name: { equals: productName, mode: 'insensitive' } },
    include: {
      client: true,
      measurements: {
        orderBy: { version: 'asc' }
      }
    }
  });
  
  if (!product) {
    return `Изделие "${productName}" не найдено.`;
  }
  
  if (product.measurements.length === 0) {
    return `У изделия "${product.name}" пока нет замеров. Начните запись командой "запоминай замеры для ${product.name}".`;
  }
  
  const measurementsList = product.measurements
    .map(m => {
      const data = JSON.parse(m.data);
      const params = Object.entries(data).map(([k, v]) => `${k}:${v}`).join(' ');
      const date = new Date(m.date).toLocaleDateString('ru-RU');
      return `Замер #${m.version} от ${date}: ${params}`;
    })
    .join('. ');
  
  return `Замеры изделия "${product.name}" (клиент: ${product.client.name}): ${measurementsList}`;
}

// Текст помощи
function getHelpText(): string {
  return `Записная книжка швеи. Я умею:
— Запоминать клиентов: "запомни нового клиента Вася"
— Создавать изделия: "создай для Васи изделие куртка"
— Записывать замеры: "запоминай замеры для куртка", затем назовите параметры и "конец записи"
— Перечислять клиентов: "перечисли клиентов"
— Показывать изделия клиента: "перечисли изделия для Васи"
— Показывать замеры изделия: "перечисли замеры для куртка"`;
}

export async function POST(request: NextRequest) {
  try {
    const body: AliceRequest = await request.json();
    const { request: req, session } = body;
    
    const sessionId = session.session_id;
    const state = sessionStates.get(sessionId);
    
    let responseText = '';
    
    // Если сессия новая, очищаем состояние
    if (session.new) {
      sessionStates.delete(sessionId);
    }
    
    // Текущее состояние после возможной очистки
    const currentState = sessionStates.get(sessionId);
    
    // Если ожидаем замеры
    if (currentState?.state === 'waiting_measurements') {
      const normalizedText = req.original_utterance.toLowerCase().trim();
      
      if (normalizedText.includes('конец записи')) {
        // Завершаем запись замеров
        responseText = await handleEndMeasurement(sessionId);
      } else {
        // Сохраняем замеры
        responseText = await handleSaveMeasurements(sessionId, req.original_utterance);
      }
    } else {
      // Обычная команда
      const parsed = parseCommand(req.original_utterance);
      
      if (!parsed) {
        responseText = 'Не поняла команду. Скажите "помощь" чтобы узнать что я умею.';
      } else {
        switch (parsed.action) {
          case 'add_client':
            responseText = await handleAddClient(parsed.params[0]);
            break;
          case 'add_product':
            responseText = await handleAddProduct(parsed.params[0], parsed.params[1]);
            break;
          case 'start_measurement':
            responseText = await handleStartMeasurement(sessionId, parsed.params[0]);
            break;
          case 'end_measurement':
            responseText = 'Сначала начните запись замеров командой "запоминай замеры для [изделие]".';
            break;
          case 'list_clients':
            responseText = await handleListClients();
            break;
          case 'list_products':
            responseText = await handleListProducts(parsed.params[0]);
            break;
          case 'list_measurements':
            responseText = await handleListMeasurements(parsed.params[0]);
            break;
          case 'help':
            responseText = getHelpText();
            break;
        }
      }
    }
    
    const response: AliceResponse = {
      response: {
        text: responseText,
        tts: responseText,
        end_session: false
      },
      session: {
        message_id: session.message_id,
        session_id: session.session_id,
        skill_id: session.skill_id,
        user_id: session.user_id
      },
      version: '1.0'
    };
    
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Alice API error:', error);
    return NextResponse.json({
      response: {
        text: 'Произошла ошибка. Попробуйте ещё раз.',
        end_session: false
      },
      version: '1.0'
    });
  }
}

// GET для проверки работы endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Навык "Записная книжка швеи" работает',
    endpoints: {
      webhook: '/api/alice',
      web: '/'
    }
  });
}
