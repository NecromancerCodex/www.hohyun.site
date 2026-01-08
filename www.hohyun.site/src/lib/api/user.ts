import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.hohyun.site";

export interface User {
  id?: number;
  name?: string;
  email?: string;
  nickname?: string;
  provider?: string;
  providerId?: string;
}

export interface UserResponse {
  code: number;
  message: string;
  data?: User;
}

/**
 * 사용자 정보 조회 (ID로)
 */
export const getUserById = async (
  userId: number,
  accessToken?: string
): Promise<UserResponse> => {
  const response = await axios.post<UserResponse>(
    `${API_BASE_URL}/api/users/findById`,
    { id: userId },
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
 * 사용자 정보 수정 (닉네임 등)
 */
export const updateUser = async (
  user: User,
  accessToken?: string
): Promise<UserResponse> => {
  const response = await axios.put<UserResponse>(
    `${API_BASE_URL}/api/users`,
    user,
    {
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

