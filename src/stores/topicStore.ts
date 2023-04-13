import { create } from 'zustand';
import { backend } from '../declarations/backend';
import { Status } from '../declarations/backend/backend.did';

export type TopicStatus = 'open' | 'next' | 'completed' | 'closed';
export type VoteStatus = 1 | 0 | -1;

export interface TopicInfo {
  title: string;
  description: string;
  links: string[];
  tags: string[];
}

export interface Topic extends TopicInfo {
  id: string;
  // owner: Principal;
  createTime: number;
  votes: number;
  status: TopicStatus;
  isOwner: boolean;
  yourVote: VoteStatus;
}

export interface TopicState {
  topics: Topic[];
  loading: boolean;
  fetch(): Promise<Topic[]>;
  create(info: TopicInfo): Promise<void>;
  bulkCreate(infoArray: TopicInfo[]): Promise<void>;
  edit(id: string, info: TopicInfo): Promise<void>;
  vote(topic: Topic, vote: VoteStatus): Promise<void>;
  changeStatus(id: string, status: TopicStatus): Promise<void>;
}

export const useTopicStore = create<TopicState>((set, get) => {
  const updateTopic = (topic: Topic) =>
    set((state) => ({
      topics: state.topics.map((other) =>
        topic.id === other.id ? topic : other,
      ),
    }));

  const statusMap: Record<TopicStatus, Status> = {
    open: { open: null },
    next: { next: null },
    completed: { completed: null },
    closed: { closed: null },
  };

  return {
    topics: [],
    loading: false,
    async fetch() {
      const results = await backend.fetch();
      const topics: Topic[] = results.map((result) => ({
        ...result,
        id: String(result.id),
        createTime: Number(result.createTime),
        votes: Number(result.upVoters - result.downVoters),
        status: Object.keys(result.status)[0] as TopicStatus,
        yourVote:
          'up' in result.yourVote ? 1 : 'down' in result.yourVote ? -1 : 0,
      }));
      set({ topics });
      console.log(topics); // temporary
      return topics;
    },
    async create(info: TopicInfo) {
      const id = String(await backend.create(info));
      const topic: Topic = {
        ...info,
        id,
        createTime: Date.now(),
        votes: 0,
        status: 'open',
        isOwner: true,
        yourVote: 0,
      };
      set((state) => ({
        topics: [topic, ...state.topics],
      }));
      // await get().fetch();
    },
    async bulkCreate(infoArray: TopicInfo[]) {
      await backend.bulkCreateTopics(infoArray);
    },
    async edit(id: string, info: TopicInfo) {
      const topic = get().topics.find((topic) => topic.id === id);
      if (topic) {
        updateTopic({ ...topic, ...info });
      }
      await backend.edit(BigInt(id), info);
    },
    async vote(topic: Topic, vote: VoteStatus) {
      updateTopic({
        ...topic,
        votes: topic.votes + vote - topic.yourVote,
        yourVote: vote,
      });
      await backend.vote(
        BigInt(topic.id),
        vote === 1
          ? { up: null }
          : vote === -1
          ? { down: null }
          : { none: null },
      );
    },
    async changeStatus(id: string, status: TopicStatus) {
      const topic = get().topics.find((topic) => topic.id === id);
      if (topic) {
        updateTopic({ ...topic, status });
      }
      await backend.changeStatus(BigInt(id), statusMap[status]);
    },
  };
});
