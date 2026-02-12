import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET - список замеров (можно фильтровать по productId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    
    const where = productId ? { productId } : {};
    
    const measurements = await db.measurement.findMany({
      where,
      orderBy: [
        { productId: 'asc' },
        { version: 'asc' }
      ],
      include: {
        product: {
          include: {
            client: true
          }
        }
      }
    });
    
    // Преобразуем data из JSON строки в объект
    const result = measurements.map(m => ({
      ...m,
      data: JSON.parse(m.data)
    }));
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - создать замер
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, data } = body;
    
    if (!productId) {
      return NextResponse.json({ error: 'ID изделия обязательно' }, { status: 400 });
    }
    
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Данные замера обязательны' }, { status: 400 });
    }
    
    // Получаем текущее количество замеров для определения версии
    const existingMeasurements = await db.measurement.count({
      where: { productId }
    });
    
    const measurement = await db.measurement.create({
      data: {
        version: existingMeasurements + 1,
        data: JSON.stringify(data),
        productId
      },
      include: {
        product: {
          include: {
            client: true
          }
        }
      }
    });
    
    return NextResponse.json({
      ...measurement,
      data: JSON.parse(measurement.data)
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - удалить замер
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID замера обязательно' }, { status: 400 });
    }
    
    await db.measurement.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
