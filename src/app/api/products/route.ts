import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET - список изделий (можно фильтровать по clientId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    
    const where = clientId ? { clientId } : {};
    
    const products = await db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: true,
        _count: {
          select: { measurements: true }
        }
      }
    });
    
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - создать изделие
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, clientId } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Название изделия обязательно' }, { status: 400 });
    }
    
    if (!clientId) {
      return NextResponse.json({ error: 'ID клиента обязательно' }, { status: 400 });
    }
    
    const product = await db.product.create({
      data: {
        name: name.trim(),
        clientId
      },
      include: {
        client: true
      }
    });
    
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Такое изделие уже есть у этого клиента' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - удалить изделие
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'ID изделия обязательно' }, { status: 400 });
    }
    
    await db.product.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
