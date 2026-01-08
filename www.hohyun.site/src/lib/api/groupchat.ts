import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.hohyun.site";

export interface GroupChatMessage {
  id?: number;
  userId: number;
  username?: string;
  message: string;
  createdAt?: string;
}

export interface GroupChatResponse {
  code: number;
  message: string;
  data?: GroupChatMessage | GroupChatMessage[];
}

/**
 * 그룹 채팅 메시지 전송
 */
export const sendGroupChatMessage = async (
  message: string,
  accessToken?: string
): Promise<GroupChatResponse> => {
  const response = await axios.post<GroupChatResponse>(
    `${API_BASE_URL}/api/groupchat`,
    { message },
    {
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

/**
 * 그룹 채팅 메시지 목록 조회 (페이징)
 */
export const getGroupChatMessages = async (
  page: number = 0,
  size: number = 50
): Promise<GroupChatResponse> => {
  const response = await axios.get<GroupChatResponse>(
    `${API_BASE_URL}/api/groupchat`,
    {
      params: { page, size },
    }
  );
  return response.data;
};

/**
 * 최근 메시지 조회 (실시간 채팅용)
 */
export const getRecentGroupChatMessages = async (
  limit: number = 50
): Promise<GroupChatResponse> => {
  const response = await axios.get<GroupChatResponse>(
    `${API_BASE_URL}/api/groupchat/recent`,
    {
      params: { limit },
    }
  );
  return response.data;
};

