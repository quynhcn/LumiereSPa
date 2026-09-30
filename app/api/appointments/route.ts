import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyToken } from '@/lib/auth/jwt';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const dateStr = url.searchParams.get('date'); // YYYY-MM-DD
    const staffId = url.searchParams.get('staff_id');

    const where: any = {};
    if (user.role === 'customer') {
      where.customer = { userId: user.id };
    } else if (user.role === 'staff') {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser?.staffId) where.staffId = dbUser.staffId;
    }

    if (dateStr) {
      const start = new Date(dateStr);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.startTime = { gte: start, lt: end };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        service: { select: { name: true, durationMinutes: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' }
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { serviceId, staffId, startTime, customerPhone, customerName, notes } = body;

    // Use Prisma transaction to lock and prevent double booking
    const result = await prisma.$transaction(async (tx) => {
      // Find service
      const service = await tx.service.findUnique({ where: { id: serviceId } });
      if (!service) throw new Error('Dịch vụ không tồn tại');

      const start = new Date(startTime);
      const end = new Date(start.getTime() + service.durationMinutes * 60000);

      // Check double booking
      const conflict = await tx.appointment.findFirst({
        where: {
          staffId,
          status: { in: ['pending', 'confirmed'] },
          OR: [
            { startTime: { lt: end }, endTime: { gt: start } }
          ]
        }
      });
      if (conflict) throw new Error('Nhân viên đã kẹt lịch trong khoảng thời gian này');

      // Find or create customer
      let customer = await tx.customer.findUnique({ where: { phone: customerPhone } });
      let isFirstVisit = false;
      if (!customer) {
        isFirstVisit = true;
        customer = await tx.customer.create({
          data: {
            phone: customerPhone,
            name: customerName,
            userId: user.role === 'customer' ? user.id : null,
          }
        });
      } else {
        const pastAppointments = await tx.appointment.count({ where: { customerId: customer.id } });
        isFirstVisit = pastAppointments === 0;
      }

      // Calculate price (basic MVP)
      let finalPrice = service.price;
      let discountAmount = 0;
      if (isFirstVisit) {
        discountAmount = finalPrice * 0.1; // 10% discount for first visit
        finalPrice -= discountAmount;
      }

      // Create appointment
      const appointment = await tx.appointment.create({
        data: {
          bookingCode: 'B' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          customerId: customer.id,
          serviceId,
          staffId,
          startTime: start,
          endTime: end,
          originalPrice: service.price,
          discountAmount,
          finalPrice,
          isFirstVisit,
          notes,
          status: 'pending'
        }
      });

      return appointment;
    });

    return NextResponse.json({ success: true, appointment: result });
  } catch (error: any) {
    console.error('Error booking:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống' }, { status: 400 });
  }
}
