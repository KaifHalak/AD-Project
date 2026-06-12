import {
  GET as getPpmuRequest,
  POST as postPpmuRequest,
} from "../../[type]/[id]/route";

async function withRequestType(params) {
  const { id } = await params;
  return { type: "request", id };
}

export async function GET(request, { params }) {
  return getPpmuRequest(request, { params: withRequestType(params) });
}

export async function POST(request, { params }) {
  return postPpmuRequest(request, { params: withRequestType(params) });
}
