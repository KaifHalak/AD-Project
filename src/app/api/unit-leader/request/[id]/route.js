import {
  GET as getUnitLeaderRequest,
  POST as postUnitLeaderRequest,
} from "../../[type]/[id]/route";

async function withRequestType(params) {
  const { id } = await params;
  return { type: "request", id };
}

export async function GET(request, { params }) {
  return getUnitLeaderRequest(request, { params: withRequestType(params) });
}

export async function POST(request, { params }) {
  return postUnitLeaderRequest(request, { params: withRequestType(params) });
}
