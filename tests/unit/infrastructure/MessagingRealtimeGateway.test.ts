import { MessagingRealtimeGateway } from '../../../src/infrastructure/realtime/MessagingRealtimeGateway';
import { conversationRoom, userRoom } from '../../../src/infrastructure/realtime/SocketServer';

function buildMessaging() {
  const calls: string[] = [];
  const messaging = {
    in: jest.fn((room: string) => ({
      socketsJoin: jest.fn(async (target: string) => {
        calls.push(`join ${room} -> ${target}`);
      }),
    })),
    to: jest.fn((room: string) => ({
      emit: jest.fn((event: string) => {
        calls.push(`emit ${event} -> ${room}`);
      }),
    })),
  };
  return { messaging, calls };
}

const conversation = { id: 7, type: 'direct', participants: [{ userId: 1 }, { userId: 2 }] };

describe('MessagingRealtimeGateway.notifyConversationCreated', () => {
  it('joins every participant, including the creator, to the new conversation room', async () => {
    const { messaging, calls } = buildMessaging();
    const gateway = new MessagingRealtimeGateway({ messaging });

    await gateway.notifyDirectCreated(conversation, 1);

    expect(calls).toContain(`join ${userRoom(1)} -> ${conversationRoom(7)}`);
    expect(calls).toContain(`join ${userRoom(2)} -> ${conversationRoom(7)}`);
  });

  it('announces conversation:new only to the participants who did not create it', async () => {
    const { messaging, calls } = buildMessaging();
    const gateway = new MessagingRealtimeGateway({ messaging });

    await gateway.notifyDirectCreated(conversation, 1);

    const announcements = calls.filter((call) => call.startsWith('emit conversation:new'));
    expect(announcements).toEqual([`emit conversation:new -> ${userRoom(2)}`]);
  });

  it('joins a participant to the room before announcing the conversation to them', async () => {
    const { messaging, calls } = buildMessaging();
    const gateway = new MessagingRealtimeGateway({ messaging });

    await gateway.notifyDirectCreated(conversation, 1);

    const joined = calls.indexOf(`join ${userRoom(2)} -> ${conversationRoom(7)}`);
    const announced = calls.indexOf(`emit conversation:new -> ${userRoom(2)}`);
    expect(joined).toBeGreaterThanOrEqual(0);
    expect(announced).toBeGreaterThan(joined);
  });

  it('now joins the creator of a group as well, while still announcing only to the members', async () => {
    const { messaging, calls } = buildMessaging();
    const gateway = new MessagingRealtimeGateway({ messaging });
    const group = { id: 9, type: 'group', participants: [{ userId: 1 }, { userId: 2 }, { userId: 3 }] };

    await gateway.notifyGroupCreated(group, 1);

    expect(calls).toContain(`join ${userRoom(1)} -> ${conversationRoom(9)}`);
    expect(calls.filter((call) => call.startsWith('emit conversation:new')).sort()).toEqual(
      [`emit conversation:new -> ${userRoom(2)}`, `emit conversation:new -> ${userRoom(3)}`].sort()
    );
  });

  it('does nothing when the realtime layer is not attached', async () => {
    const gateway = new MessagingRealtimeGateway({ messaging: null });

    await expect(gateway.notifyDirectCreated(conversation, 1)).resolves.toBeUndefined();
  });
});
